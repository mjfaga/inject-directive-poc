const {ApolloServer, gql} = require('apollo-server');
const {buildFederatedSchema} = require('@apollo/federation');
const {globalIdField, fromGlobalId} = require('graphql-relay');
const productArray = require('./products.json');
const productMap = productArray.reduce((agg, p) => {
  agg[p.sku] = p;
  return agg;
}, {});

const typeDefs = gql`
  interface Node {
    id: ID!
  }

  type Product implements Node @key(fields: "sku") {
    id: ID!
    sku: String!
    name: String!
    brand: Brand
  }

  extend type Brand @key(fields: "brandId") {
    brandId: Int! @external
  }

  type Query {
    product(sku: String!): Product
    node(id: ID!): Node
  }
`;

const resolvers = {
  Product: {
    __resolveReference(object) {
      return productMap[object.sku];
    },
    id: globalIdField(null, object => object.sku).resolve,
    brand(object) {
      return {
        __typename: 'Brand',
        brandId: object.brandId,
      };
    },
  },
  Node: {
    __resolveType() {
      return 'Product';
    },
  },
  Query: {
    product: async (root, args) => {
      return productMap[args.sku];
    },
    // Faking the node implementation directly in this subgraph for the demo.
    // This would be implemented in the gateway in a real production implementation.
    node: async (root, args) => {
      const {id, type} = fromGlobalId(args.id);
      console.log('-----------------------------------------------');
      console.log('Resolving node value for', type, id);
      console.log('-----------------------------------------------');
      return productMap[id];
    },
  },
};

const schema = buildFederatedSchema([
  {
    typeDefs,
    resolvers,
  },
]);

const server = new ApolloServer({
  schema,
  context: ({req}) => {
    // get the auth value from the request and pass it into context here
    return {authorization: req.headers['authorization']};
  },
});

server.listen({port: 4001}).then(({url}) => {
  console.log(`🚀 Product service ready at ${url}`);
});
