const {ApolloServer} = require('apollo-server');
const {ApolloGateway} = require('@apollo/gateway');

const serviceList = [
  {name: 'product', url: `http://localhost:4001/graphql`},
  {name: 'review', url: `http://localhost:4002/graphql`},
  {name: 'shipping', url: `http://localhost:4003/graphql`},
  {name: 'brand', url: `http://localhost:4004/graphql`},
];

console.log('Gateway is connnecting to:');
serviceList.forEach(service =>
  console.log('\t-', `${service.name} :`, service.url)
);

const gateway = new ApolloGateway({
  serviceList,
});

(async () => {
  const server = new ApolloServer({
    gateway,
    subscriptions: false,
  });

  server.listen({port: 4000}).then(({url}) => {
    console.log(`🚀 Federation server ready at ${url}`);
  });
})();
