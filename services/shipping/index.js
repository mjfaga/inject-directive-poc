const {ApolloServer, gql} = require('apollo-server');
const {buildFederatedSchema} = require('@apollo/federation');
const {SchemaDirectiveVisitor} = require('graphql-tools');
const {toGlobalId} = require('graphql-relay');
const fetch = require('node-fetch');
const shippingBaseMap = require('./shippingBase.json');

const log = (...args) => {
  console.log('===============================================');
  console.log(...args);
  console.log('===============================================');
};

class InjectDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field) {
    log(`Setting up inject directive on ${field.name}`);
    const resolve = field.resolve || (object => object[field.name]);

    field.inject = {fields: this.args.fields, mode: this.args.mode};

    field.resolve = async function(parent, args, context, info) {
      const injectInvoke = (/*customHeaders, variables, etc.*/) => {
        log(
          `Executing additional gateway query to get '${field.inject.fields}'`
        );
        const body = {
          query: `
            query InvokeDirective($id: ID!) {
              # In order for this to work, we need to always @require 'id' field during initial execution when this directive is used
              node(id: $id) {
                ... on ${info.parentType} {
                  id
                  ${field.inject.fields}
                }
              }
            }`,
          variables: {
            id: parent.id,
          },
        };
        // track executing the fetch
        return fetch('http://localhost:4000/', {
          method: 'POST',
          body: JSON.stringify(body),
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        })
          .then(res => {
            // track resolving the fetch
            log(
              `Resolved additional gateway query to get '${field.inject.fields}'`
            );
            return res.json();
          })
          .then(json => {
            return json.data.node;
          })
          .catch(err => {});
      };

      // We don't handle Mode = SYNC because we translate the directive config to @requires
      if (field.inject.mode === 'INVOKE') {
        args.injectInvoke = injectInvoke;
      } else {
        args.injectPromise = injectInvoke();
      }

      const result = await resolve(parent, args, context, info);

      return result;
    };
  }
}

// Runs at Gateway
const SYNC = `
      @requires(fields: "name")
`;

// Need to @require 'id' field in order to execute node query for async resolution
// Runs in Subgraph (option to optimize into Gatway in future)
const ASYNC = `
      @requires(fields: "id") @inject(fields: "name", mode: ASYNC)
`;

// Need to @require 'id' field in order to execute node query for async resolution
// Runs in Subgraph always
const INVOKE = `
      @requires(fields: "id") @inject(fields: "name", mode: INVOKE)
`;

let directiveType = '';

switch (process.env.INJECT_MODE) {
  case 'SYNC':
    directiveType = SYNC;
    break;
  case 'ASYNC':
    directiveType = ASYNC;
    break;
  case 'INVOKE':
    directiveType = INVOKE;
    break;
}

const typeDefs = gql`
  enum InjectMode {
    SYNC
    ASYNC
    INVOKE
  }

  # Could make this repeatable as well. Would need to handle promise/invokation injection differently though.
  directive @inject(fields: String!, mode: InjectMode!) on FIELD_DEFINITION

  type ShippingEstimate {
    message: String!
    days: Int!
  }

  extend type Product @key(fields: "sku") {
    sku: String! @external
    # Needed for @requires when it's used
    ${process.env.INJECT_MODE === 'SYNC' ? 'name: String! @external' : ''}
    ${
      process.env.INJECT_MODE && process.env.INJECT_MODE !== 'SYNC'
        ? 'id: ID! @external'
        : ''
    }
    shippingEstimate(zipcode: String!): ShippingEstimate ${directiveType}
  }
`;

const resolvers = {
  Product: {
    async shippingEstimate(parent, args) {
      let multiplier = 1;

      if (parseInt(args.zipcode) > 20000) {
        multiplier = 2;
      }

      const days = shippingBaseMap[parent.sku] * multiplier;

      let productName = parent.name ? `'${parent.name}'` : 'it';
      if (args.injectInvoke) {
        log('Inject: invoking and waiting for result from inject promise');
        const data = await args.injectInvoke(/* pass custom headers, etc*/);
        log('Inject: resolved', data);
        productName = `'${data.name}'`;
      } else if (args.injectPromise) {
        log('Inject: waiting for result from inject promise');
        const data = await args.injectPromise;
        log('Inject: resolved', data);
        productName = `'${data.name}'`;
      }

      return {
        days,
        message: `Get ${productName} in ${days} day(s)`,
      };
    },
  },
};

const schema = buildFederatedSchema([
  {
    typeDefs,
    resolvers,
  },
]);

SchemaDirectiveVisitor.visitSchemaDirectives(schema, {
  inject: InjectDirective,
});

const server = new ApolloServer({
  schema,
});

server.listen({port: 4003}).then(({url}) => {
  console.log(`🚀 Shipping service ready at ${url}`);
});
