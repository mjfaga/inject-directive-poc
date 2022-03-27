const {ApolloServer, gql} = require('apollo-server');
const {buildFederatedSchema} = require('@apollo/federation');
const {globalIdField} = require('graphql-relay');
const brandArray = require('./brands.json');
const brandMap = brandArray.reduce((agg, p) => {
  agg[p.id] = p;
  return agg;
}, {});

const typeDefs = gql`
  type Brand @key(fields: "brandId") {
    id: ID!
    brandId: Int!
    name: String!
  }
`;

const resolvers = {
  Brand: {
    id: globalIdField().resolve,
    brandId(object) {
      return object.id;
    },
    __resolveReference(object) {
      return brandMap[object.brandId];
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

server.listen({port: 4004}).then(({url}) => {
  console.log(`🚀 Brand service ready at ${url}`);
});
