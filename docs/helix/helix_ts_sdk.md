> ## Documentation Index
> Fetch the complete documentation index at: https://docs.helix-db.com/llms.txt
> Use this file to discover all available pages before exploring further.

# TypeScript SDK

> Getting started with HelixDBs TypeScript SDK.

[helix-ts](https://github.com/HelixDB/helix-ts) is a TypeScript library for interacting with [helix-db](https://github.com/HelixDB/helix-db) a powerful graph-vector database written in rust. It enables intuitive and type-safe access to graph-based and vector-based queries, making it ideal for building knowledge graphs, search systems, and LLM pipelines.

## Installation

```bash  theme={"languages":{"custom":["languages/helixql.json"]}}
npm install helix-ts
```

## Quick Start

<CodeGroup>
  ```ts main.ts theme={"languages":{"custom":["languages/helixql.json"]}}
  import HelixDB from "helix-ts";

  async function main() {
      const client = new HelixDB("http://localhost:6969");

      const result = await client.query("AddUser", {
          name: "Alice",
          age: 25,
      });

      console.log("Created user:", result);
  }

  main().catch((err) => {
      console.error("AddUser query failed:", err);
  });

  ```

  ```js queries.hx theme={"languages":{"custom":["languages/helixql.json"]}}
  QUERY AddUser(name: String, age: U8) =>
      user <- AddN<User>({
          name: name,
          age: age
      })
      RETURN user

  ```

  ```js schema.hx theme={"languages":{"custom":["languages/helixql.json"]}}
  N::User {
      name: String,
      age: U8
  }
  ```
</CodeGroup>

## Configuration

### Custom Endpoint

```ts  theme={"languages":{"custom":["languages/helixql.json"]}}
const client = new HelixDB("https://my-endpoint.com:8080");
```
