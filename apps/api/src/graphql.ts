import type { FastifyInstance } from "fastify";
import {
  GraphQLEnumType,
  GraphQLBoolean,
  GraphQLError,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
  Kind,
  graphql,
  parse,
  type DocumentNode,
  type FragmentDefinitionNode,
  type OperationDefinitionNode,
  type SelectionNode,
  type SelectionSetNode,
  type ValueNode
} from "graphql";
import type { AccessPrincipal, EntityRef, RecordEntityType } from "@clientloop/domain";
import { principalFromRequest } from "./auth";
import type { CRMRepository } from "./repository";

const MAX_GRAPHQL_QUERY_LENGTH = 20_000;
const MAX_GRAPHQL_EXPANDED_FIELDS = 100;
// The deepest valid record-detail path is recordDetail -> timeline item -> parent -> scalar.
const MAX_GRAPHQL_DEPTH = 4;
const MAX_RECORD_DETAIL_ROOT_FIELDS = 1;

interface GraphqlContext {
  repository: CRMRepository;
  principal: AccessPrincipal;
}

const GraphQLJSON = new GraphQLScalarType({
  name: "JSON",
  description: "A JSON value returned by ClientLoop read models.",
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: (node) => jsonFromAst(node)
});

const RecordEntityTypeEnum = new GraphQLEnumType({
  name: "RecordEntityType",
  values: {
    ACCOUNT: { value: "account" },
    CONTACT: { value: "contact" },
    LEAD: { value: "lead" },
    OPPORTUNITY: { value: "opportunity" }
  }
});

const auditFields = {
  id: { type: new GraphQLNonNull(GraphQLID) },
  tenantId: { type: new GraphQLNonNull(GraphQLID) },
  createdAt: { type: new GraphQLNonNull(GraphQLString) },
  updatedAt: { type: new GraphQLNonNull(GraphQLString) },
  createdBy: { type: new GraphQLNonNull(GraphQLID) },
  updatedBy: { type: new GraphQLNonNull(GraphQLID) },
  version: { type: new GraphQLNonNull(GraphQLInt) }
};

const AccountType = new GraphQLObjectType({
  name: "Account",
  fields: {
    ...auditFields,
    name: { type: new GraphQLNonNull(GraphQLString) },
    domain: { type: GraphQLString },
    ownerUserId: { type: GraphQLID },
    status: { type: new GraphQLNonNull(GraphQLString) },
    customFields: { type: new GraphQLNonNull(GraphQLJSON) }
  }
});

const ContactType = new GraphQLObjectType({
  name: "Contact",
  fields: {
    ...auditFields,
    accountId: { type: GraphQLID },
    firstName: { type: new GraphQLNonNull(GraphQLString) },
    lastName: { type: new GraphQLNonNull(GraphQLString) },
    email: { type: GraphQLString },
    phone: { type: GraphQLString },
    ownerUserId: { type: GraphQLID },
    customFields: { type: new GraphQLNonNull(GraphQLJSON) }
  }
});

const LeadType = new GraphQLObjectType({
  name: "Lead",
  fields: {
    ...auditFields,
    source: { type: new GraphQLNonNull(GraphQLString) },
    companyName: { type: GraphQLString },
    contactName: { type: new GraphQLNonNull(GraphQLString) },
    email: { type: GraphQLString },
    status: { type: new GraphQLNonNull(GraphQLString) },
    convertedAt: { type: GraphQLString },
    convertedAccountId: { type: GraphQLID },
    convertedContactId: { type: GraphQLID },
    convertedOpportunityId: { type: GraphQLID },
    customFields: { type: new GraphQLNonNull(GraphQLJSON) }
  }
});

const OpportunityType = new GraphQLObjectType({
  name: "Opportunity",
  fields: {
    ...auditFields,
    accountId: { type: new GraphQLNonNull(GraphQLID) },
    primaryContactId: { type: GraphQLID },
    name: { type: new GraphQLNonNull(GraphQLString) },
    stage: { type: new GraphQLNonNull(GraphQLString) },
    amount: { type: GraphQLFloat },
    currency: { type: new GraphQLNonNull(GraphQLString) },
    expectedCloseDate: { type: GraphQLString },
    ownerUserId: { type: new GraphQLNonNull(GraphQLID) },
    probabilityPct: { type: GraphQLInt },
    customFields: { type: new GraphQLNonNull(GraphQLJSON) }
  }
});

const EntityRefType = new GraphQLObjectType({
  name: "EntityRef",
  fields: {
    type: { type: new GraphQLNonNull(GraphQLString) },
    id: { type: new GraphQLNonNull(GraphQLID) }
  }
});

const TaskType = new GraphQLObjectType({
  name: "Task",
  fields: {
    ...auditFields,
    parent: { type: EntityRefType },
    title: { type: new GraphQLNonNull(GraphQLString) },
    description: { type: GraphQLString },
    status: { type: new GraphQLNonNull(GraphQLString) },
    priority: { type: new GraphQLNonNull(GraphQLString) },
    dueAt: { type: GraphQLString },
    assignedUserId: { type: new GraphQLNonNull(GraphQLID) }
  }
});

const NoteType = new GraphQLObjectType({
  name: "Note",
  fields: {
    ...auditFields,
    parent: { type: new GraphQLNonNull(EntityRefType) },
    body: { type: new GraphQLNonNull(GraphQLString) },
    bodyFormat: { type: new GraphQLNonNull(GraphQLString) }
  }
});

const ActivityType = new GraphQLObjectType({
  name: "Activity",
  fields: {
    ...auditFields,
    parent: { type: new GraphQLNonNull(EntityRefType) },
    type: { type: new GraphQLNonNull(GraphQLString) },
    subject: { type: new GraphQLNonNull(GraphQLString) },
    occurredAt: { type: new GraphQLNonNull(GraphQLString) },
    payload: { type: new GraphQLNonNull(GraphQLJSON) }
  }
});

const CustomFieldDefinitionType = new GraphQLObjectType({
  name: "CustomFieldDefinition",
  fields: {
    ...auditFields,
    entityType: { type: new GraphQLNonNull(GraphQLString) },
    key: { type: new GraphQLNonNull(GraphQLString) },
    label: { type: new GraphQLNonNull(GraphQLString) },
    fieldType: { type: new GraphQLNonNull(GraphQLString) },
    required: { type: new GraphQLNonNull(GraphQLBoolean) },
    isIndexed: { type: new GraphQLNonNull(GraphQLBoolean) },
    schema: { type: GraphQLJSON }
  }
});

const RecordDetailType = new GraphQLObjectType({
  name: "RecordDetail",
  fields: {
    entityType: { type: new GraphQLNonNull(RecordEntityTypeEnum) },
    account: { type: AccountType },
    contact: { type: ContactType },
    lead: { type: LeadType },
    opportunity: { type: OpportunityType },
    contacts: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(ContactType))) },
    opportunities: {
      type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(OpportunityType)))
    },
    tasks: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(TaskType))) },
    notes: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(NoteType))) },
    activities: { type: new GraphQLNonNull(new GraphQLList(new GraphQLNonNull(ActivityType))) },
    customFieldDefinitions: {
      type: new GraphQLNonNull(
        new GraphQLList(new GraphQLNonNull(CustomFieldDefinitionType))
      )
    }
  }
});

const QueryType = new GraphQLObjectType<unknown, GraphqlContext>({
  name: "Query",
  fields: {
    recordDetail: {
      type: RecordDetailType,
      args: {
        entityType: { type: new GraphQLNonNull(RecordEntityTypeEnum) },
        id: { type: new GraphQLNonNull(GraphQLID) }
      },
      resolve: async (_source, args, context) =>
        buildRecordDetail(
          context.repository,
          context.principal,
          args.entityType as RecordEntityType,
          String(args.id)
        )
    }
  }
});

export const clientloopGraphqlSchema = new GraphQLSchema({ query: QueryType });

export async function registerGraphqlRoute(app: FastifyInstance, repository: CRMRepository) {
  app.post("/graphql", async (request, reply) => {
    const body = request.body as {
      query?: unknown;
      variables?: unknown;
      operationName?: unknown;
    } | null;
    if (!body || typeof body.query !== "string" || body.query.length === 0) {
      return reply.code(400).send({ error: "GraphQL query must be a non-empty string" });
    }
    if (body.query.length > MAX_GRAPHQL_QUERY_LENGTH) {
      return reply.code(400).send({ error: "GraphQL query is too large" });
    }

    try {
      const document = parse(body.query);
      const limitError = graphqlQueryLimitError(
        document,
        typeof body.operationName === "string" ? body.operationName : undefined
      );
      if (limitError) {
        return reply.code(400).send({ error: limitError });
      }
    } catch (error) {
      return reply.code(400).send({
        error: error instanceof Error ? error.message : "Invalid GraphQL query"
      });
    }

    const principal = await principalFromRequest(request, repository);
    const result = await graphql({
      schema: clientloopGraphqlSchema,
      source: body.query,
      variableValues:
        body.variables && typeof body.variables === "object"
          ? (body.variables as Record<string, unknown>)
          : undefined,
      operationName: typeof body.operationName === "string" ? body.operationName : undefined,
      contextValue: { repository, principal } satisfies GraphqlContext
    });

    if (!result.errors) {
      return result;
    }

    return {
      ...result,
      errors: result.errors.map((error) => {
        // Validation errors have no response path and are safe, useful feedback
        // about the caller's own document. Resolver errors can contain database,
        // infrastructure, or secret-bearing diagnostics and must stay server-side.
        if (!error.path) {
          return error;
        }

        request.log.error(
          {
            err: error.originalError ?? error,
            graphqlPath: error.path
          },
          "GraphQL resolver failed"
        );
        return new GraphQLError("Internal server error", {
          nodes: error.nodes,
          path: error.path,
          extensions: { code: "INTERNAL_SERVER_ERROR" }
        });
      })
    };
  });
}

function graphqlQueryLimitError(
  document: DocumentNode,
  operationName: string | undefined
): string | undefined {
  const fragments = new Map<string, FragmentDefinitionNode>();
  const operations: OperationDefinitionNode[] = [];

  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(definition.name.value, definition);
    } else if (definition.kind === Kind.OPERATION_DEFINITION) {
      operations.push(definition);
    }
  }

  const selectedOperations = operationName
    ? operations.filter((operation) => operation.name?.value === operationName)
    : operations.length === 1
      ? operations
      : [];

  for (const operation of selectedOperations) {
    let expandedFieldCount = 0;
    let recordDetailRootFieldCount = 0;
    const pendingSelections: Array<{
      selection: SelectionNode;
      fieldDepth: number;
      activeFragments: ReadonlySet<string>;
    }> = [];
    const pushSelectionSet = (
      selectionSet: SelectionSetNode,
      fieldDepth: number,
      activeFragments: ReadonlySet<string>
    ) => {
      for (let index = selectionSet.selections.length - 1; index >= 0; index -= 1) {
        pendingSelections.push({
          selection: selectionSet.selections[index]!,
          fieldDepth,
          activeFragments
        });
      }
    };

    pushSelectionSet(operation.selectionSet, 1, new Set());
    while (pendingSelections.length > 0) {
      const { selection, fieldDepth, activeFragments } = pendingSelections.pop()!;
      if (selection.kind === Kind.FIELD) {
        expandedFieldCount += 1;
        if (expandedFieldCount > MAX_GRAPHQL_EXPANDED_FIELDS) {
          return "GraphQL query selects too many fields";
        }
        if (fieldDepth > MAX_GRAPHQL_DEPTH) {
          return "GraphQL query is too deeply nested";
        }
        if (fieldDepth === 1 && selection.name.value === "recordDetail") {
          recordDetailRootFieldCount += 1;
          if (recordDetailRootFieldCount > MAX_RECORD_DETAIL_ROOT_FIELDS) {
            return "GraphQL operation may select recordDetail only once";
          }
        }
        if (selection.selectionSet) {
          pushSelectionSet(selection.selectionSet, fieldDepth + 1, activeFragments);
        }
        continue;
      }

      if (selection.kind === Kind.INLINE_FRAGMENT) {
        pushSelectionSet(selection.selectionSet, fieldDepth, activeFragments);
        continue;
      }

      const fragmentName = selection.name.value;
      if (activeFragments.has(fragmentName)) {
        return "GraphQL query contains a fragment cycle";
      }

      const fragment = fragments.get(fragmentName);
      if (!fragment) {
        continue;
      }

      const fragmentPath = new Set(activeFragments);
      fragmentPath.add(fragmentName);
      pushSelectionSet(fragment.selectionSet, fieldDepth, fragmentPath);
    }
  }

  return undefined;
}

async function buildRecordDetail(
  repository: CRMRepository,
  principal: AccessPrincipal,
  entityType: RecordEntityType,
  id: string
) {
  const dashboard = await repository.dashboard(principal.tenantId);
  const account = entityType === "account"
    ? dashboard.accounts.find((record) => record.id === id)
    : entityType === "contact"
      ? dashboard.accounts.find(
          (record) =>
            record.id === dashboard.contacts.find((contact) => contact.id === id)?.accountId
        )
      : entityType === "opportunity"
        ? dashboard.accounts.find(
            (record) =>
              record.id === dashboard.opportunities.find((opportunity) => opportunity.id === id)?.accountId
          )
        : dashboard.accounts.find(
            (record) => record.id === dashboard.leads.find((lead) => lead.id === id)?.convertedAccountId
          );
  const contact = entityType === "contact"
    ? dashboard.contacts.find((record) => record.id === id)
    : entityType === "opportunity"
      ? dashboard.contacts.find(
          (record) =>
            record.id === dashboard.opportunities.find((opportunity) => opportunity.id === id)?.primaryContactId
        )
      : entityType === "lead"
        ? dashboard.contacts.find(
            (record) => record.id === dashboard.leads.find((lead) => lead.id === id)?.convertedContactId
          )
        : undefined;
  const lead = entityType === "lead" ? dashboard.leads.find((record) => record.id === id) : undefined;
  const opportunity = entityType === "opportunity"
    ? dashboard.opportunities.find((record) => record.id === id)
    : entityType === "lead"
      ? dashboard.opportunities.find(
          (record) => record.id === dashboard.leads.find((candidate) => candidate.id === id)?.convertedOpportunityId
        )
      : undefined;

  const requestedRecord = entityType === "account"
    ? account
    : entityType === "contact"
      ? contact
      : entityType === "lead"
        ? lead
        : opportunity;
  if (!requestedRecord) {
    throw new Error("Record not found");
  }

  const accountId = entityType === "account" ? id : account?.id;
  const parentMatches = (parent: EntityRef | undefined) =>
    parent?.type === entityType && parent.id === id;

  return {
    entityType,
    account,
    contact,
    lead,
    opportunity,
    contacts: accountId
      ? dashboard.contacts.filter((candidate) => candidate.accountId === accountId)
      : contact
        ? [contact]
        : [],
    opportunities: accountId
      ? dashboard.opportunities.filter((candidate) => candidate.accountId === accountId)
      : opportunity
        ? [opportunity]
        : [],
    tasks: dashboard.tasks.filter((candidate) => parentMatches(candidate.parent)),
    notes: dashboard.notes.filter((candidate) => parentMatches(candidate.parent)),
    activities: dashboard.activities.filter((candidate) => parentMatches(candidate.parent)),
    customFieldDefinitions: dashboard.customFieldDefinitions.filter(
      (candidate) => candidate.entityType === entityType
    )
  };
}

function jsonFromAst(node: ValueNode): unknown {
  switch (node.kind) {
    case Kind.NULL:
      return null;
    case Kind.STRING:
    case Kind.BOOLEAN:
      return node.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(node.value);
    case Kind.LIST:
      return node.values.map(jsonFromAst);
    case Kind.OBJECT:
      return Object.fromEntries(node.fields.map((field) => [field.name.value, jsonFromAst(field.value)]));
    default:
      return undefined;
  }
}
