# @inject Directive Proof of Concept

```graphql
enum InjectMode {
  SYNC
  ASYNC
  INVOKE
}

# Could make this repeatable as well. Would need to handle promise/invokation injection differently though.
directive @inject(fields: String!, mode: InjectMode!) on FIELD_DEFINITION
```

## `InjectMode` Enum

- **SYNC**: Identical to `@requires`, in fact, we are using that directly here
  for simplicity. In production, we would likely leverage a schema transform.
- **ASYNC**: Additional request is made to gateway to resolve data and injects
  promise into resolve to wait for resolution. In production, this should happen
  at gateway level and pipe should be opened to subgraph to push data once
  resolved.
- **INVOKE**: Additional request is injected directly into resolver for
  invocation if needed. This currently leverages the gateway, but could also be
  enhanced to support restful calls to other services.

## Running Locally

Install dependencies locally:

```sh
yarn install
```

Start all subgraphs + gateway:

```sh
yarn start:services
# INJECT_MODE=SYNC yarn start:services
# INJECT_MODE=ASYNC yarn start:services
# INJECT_MODE=INVOKE yarn start:services
```

Services can be found at:

| Server            | Address               |
| ----------------- | --------------------- |
| Product Service   | http://localhost:4001 |
| Review Service    | http://localhost:4002 |
| Shipping Service  | http://localhost:4003 |
| Brand Service     | http://localhost:4004 |
| Federated Gateway | http://localhost:4000 |

## Example Query

```graphql
query GetProduct {
  # Skus available to use: `abc`, `def`, `ghi` and `jkl`
  product(sku: "abc") {
    id
    sku
    name
    brand {
      id
      brandId
      name
    }
    reviews {
      id
      author
      text
    }
    shippingEstimate(zipcode: "29143") {
      message
      days
    }
  }
}
```
