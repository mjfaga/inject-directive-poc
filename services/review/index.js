const {ApolloServer, gql} = require('apollo-server');
const {buildFederatedSchema} = require('@apollo/federation');
const {globalIdField} = require('graphql-relay');
const reviewArray = require('./reviews.json');
const reviewMap = reviewArray.reduce((agg, r) => {
  agg[r.sku] = agg[r.sku] || [];
  agg[r.sku].push(r);
  return agg;
}, {});

const typeDefs = gql`
  type Review {
    id: ID!
    databaseId: Int!
    sku: String!
    author: String!
    text: String!
  }

  extend type Product @key(fields: "sku") {
    sku: String! @external
    reviews: [Review!]!
  }
`;

const resolvers = {
  Product: {
    reviews(object) {
      return reviewMap[object.sku] || [];
    },
  },
  Review: {
    id: globalIdField().resolve,
    databaseId(object) {
      return object.id;
    },
  },
};

const server = new ApolloServer({
  schema: buildFederatedSchema([
    {
      typeDefs,
      resolvers,
    },
  ]),
});

server.listen({port: 4002}).then(({url}) => {
  console.log(`🚀 Review service ready at ${url}`);
});
