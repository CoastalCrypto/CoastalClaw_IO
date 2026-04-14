import { GraphQLResolveInfo } from 'graphql';
import { GraphQLContext } from './context';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
};

export type Agent = {
  __typename?: 'Agent';
  id: Scalars['ID']['output'];
  label: Scalars['String']['output'];
  lastActivity?: Maybe<Scalars['Int']['output']>;
  role: Scalars['String']['output'];
  status: AgentStatus;
  toolsCount: Scalars['Int']['output'];
};

export enum AgentStatus {
  Error = 'ERROR',
  Executing = 'EXECUTING',
  Idle = 'IDLE',
  Offline = 'OFFLINE',
  Thinking = 'THINKING'
}

export type CycleReport = {
  __typename?: 'CycleReport';
  agentsCaught: Array<Agent>;
  cycles: Array<Array<Agent>>;
  severity: Scalars['String']['output'];
};

export type DependencyAnalysis = {
  __typename?: 'DependencyAnalysis';
  agent: Agent;
  cycles: Array<Array<Agent>>;
  dependents: Array<Agent>;
  depthToLeaf: Scalars['Int']['output'];
  directDependencies: Array<Agent>;
  impactRadius: Scalars['Int']['output'];
  transitiveDependencies: Array<Agent>;
};

export type Edge = {
  __typename?: 'Edge';
  active: Scalars['Boolean']['output'];
  edgeType?: Maybe<EdgeType>;
  id: Scalars['ID']['output'];
  label?: Maybe<Scalars['String']['output']>;
  source: Scalars['ID']['output'];
  target: Scalars['ID']['output'];
};

export enum EdgeType {
  AgentChannel = 'AGENT_CHANNEL',
  AgentModel = 'AGENT_MODEL',
  AgentTool = 'AGENT_TOOL'
}

export type ImpactReport = {
  __typename?: 'ImpactReport';
  agent: Agent;
  criticalPath: Array<Agent>;
  directDependents: Array<Agent>;
  indirectDependents: Array<Agent>;
  totalAffected: Scalars['Int']['output'];
};

export type Query = {
  __typename?: 'Query';
  agent?: Maybe<Agent>;
  agents: Array<Agent>;
  analyzeDependencies: DependencyAnalysis;
  findCycles: CycleReport;
  findPath?: Maybe<Array<Agent>>;
  impactAnalysis: ImpactReport;
};


export type QueryAgentArgs = {
  id: Scalars['ID']['input'];
};


export type QueryAnalyzeDependenciesArgs = {
  agentId: Scalars['ID']['input'];
};


export type QueryFindPathArgs = {
  from: Scalars['ID']['input'];
  to: Scalars['ID']['input'];
};


export type QueryImpactAnalysisArgs = {
  agentId: Scalars['ID']['input'];
};

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = Record<PropertyKey, never>, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;





/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  Agent: ResolverTypeWrapper<Agent>;
  AgentStatus: AgentStatus;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  CycleReport: ResolverTypeWrapper<CycleReport>;
  DependencyAnalysis: ResolverTypeWrapper<DependencyAnalysis>;
  Edge: ResolverTypeWrapper<Edge>;
  EdgeType: EdgeType;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  ImpactReport: ResolverTypeWrapper<ImpactReport>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  Agent: Agent;
  Boolean: Scalars['Boolean']['output'];
  CycleReport: CycleReport;
  DependencyAnalysis: DependencyAnalysis;
  Edge: Edge;
  ID: Scalars['ID']['output'];
  ImpactReport: ImpactReport;
  Int: Scalars['Int']['output'];
  Query: Record<PropertyKey, never>;
  String: Scalars['String']['output'];
}>;

export type AgentResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Agent'] = ResolversParentTypes['Agent']> = ResolversObject<{
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  label?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  lastActivity?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  role?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['AgentStatus'], ParentType, ContextType>;
  toolsCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type CycleReportResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['CycleReport'] = ResolversParentTypes['CycleReport']> = ResolversObject<{
  agentsCaught?: Resolver<Array<ResolversTypes['Agent']>, ParentType, ContextType>;
  cycles?: Resolver<Array<Array<ResolversTypes['Agent']>>, ParentType, ContextType>;
  severity?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
}>;

export type DependencyAnalysisResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['DependencyAnalysis'] = ResolversParentTypes['DependencyAnalysis']> = ResolversObject<{
  agent?: Resolver<ResolversTypes['Agent'], ParentType, ContextType>;
  cycles?: Resolver<Array<Array<ResolversTypes['Agent']>>, ParentType, ContextType>;
  dependents?: Resolver<Array<ResolversTypes['Agent']>, ParentType, ContextType>;
  depthToLeaf?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  directDependencies?: Resolver<Array<ResolversTypes['Agent']>, ParentType, ContextType>;
  impactRadius?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  transitiveDependencies?: Resolver<Array<ResolversTypes['Agent']>, ParentType, ContextType>;
}>;

export type EdgeResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Edge'] = ResolversParentTypes['Edge']> = ResolversObject<{
  active?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  edgeType?: Resolver<Maybe<ResolversTypes['EdgeType']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  label?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  source?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  target?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
}>;

export type ImpactReportResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ImpactReport'] = ResolversParentTypes['ImpactReport']> = ResolversObject<{
  agent?: Resolver<ResolversTypes['Agent'], ParentType, ContextType>;
  criticalPath?: Resolver<Array<ResolversTypes['Agent']>, ParentType, ContextType>;
  directDependents?: Resolver<Array<ResolversTypes['Agent']>, ParentType, ContextType>;
  indirectDependents?: Resolver<Array<ResolversTypes['Agent']>, ParentType, ContextType>;
  totalAffected?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  agent?: Resolver<Maybe<ResolversTypes['Agent']>, ParentType, ContextType, RequireFields<QueryAgentArgs, 'id'>>;
  agents?: Resolver<Array<ResolversTypes['Agent']>, ParentType, ContextType>;
  analyzeDependencies?: Resolver<ResolversTypes['DependencyAnalysis'], ParentType, ContextType, RequireFields<QueryAnalyzeDependenciesArgs, 'agentId'>>;
  findCycles?: Resolver<ResolversTypes['CycleReport'], ParentType, ContextType>;
  findPath?: Resolver<Maybe<Array<ResolversTypes['Agent']>>, ParentType, ContextType, RequireFields<QueryFindPathArgs, 'from' | 'to'>>;
  impactAnalysis?: Resolver<ResolversTypes['ImpactReport'], ParentType, ContextType, RequireFields<QueryImpactAnalysisArgs, 'agentId'>>;
}>;

export type Resolvers<ContextType = GraphQLContext> = ResolversObject<{
  Agent?: AgentResolvers<ContextType>;
  CycleReport?: CycleReportResolvers<ContextType>;
  DependencyAnalysis?: DependencyAnalysisResolvers<ContextType>;
  Edge?: EdgeResolvers<ContextType>;
  ImpactReport?: ImpactReportResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
}>;

