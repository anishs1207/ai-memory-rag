to run it:

npm run dev
$ npm run dev

> openapi-sepc@1.0.0 dev
> npx tsc && node dist/index.js

Running on http://localhost:8787


2. Generate the client
npx openapi-typescript-codegen --input ./spec.json --output ./generated

Explore the client
cd generated
cat index.ts

Use it in a different project

Swagger UI: http://localhost:8787/ui
OpenAPI Specs: http://localhost:8787/doc
Example User API: http://localhost:8787/users/1212121