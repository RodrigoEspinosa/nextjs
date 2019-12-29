# @rec/serverless-nextjs

**Deploy Serverless Next.js apps with Serverless Components**
This is still a work in progress and is very heavily based on [@danielcondemarin/serverless-nextjs-component](https://github.com/danielcondemarin/serverless-next.js/tree/master/packages/serverless-nextjs-component) project.

## Main differences [@danielcondemarin/serverless-nextjs-component](https://github.com/danielcondemarin/serverless-next.js/tree/master/packages/serverless-nextjs-component)

- Same `domain` format (as a string) to the other @serverless components.
- Same code style to the other @serverless components.
- **No dependencies**.
- Same `input.code` format with working hook like the other @serverless components.
- Dynamic routes using Next.js `routes-manifest.json` to ensure maximum compatibility.

## Example

```yml
api:
  component: '@serverless/backend'
  inputs:
    code:
      src: ./api
    env:
      SOME_ENV: testing
    domain: api.example.com

web:
  component: '@rec/serverless-nextjs'
  inputs:
    code:
      root: ./web
      src: .next/serverless
      hook: npm run build
    env:
      API_URL: ${api.domain}
    domain: example.com
```

## LICENSE

MIT License

Copyright (c) 2019 Rodrigo Espinosa Curbelo

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

_(The same [CODE_OF_CONDUCT](./CODE_OF_CONDUCT.md) applies as other official Serverless components)._
