# UBE-12 - Create basic documentation

## Linear issue

https://linear.app/uberconcept/issue/UBE-12/create-basic-documentation

> Create diagrams of the overall structure of the project. This includes:
> * logical structure (Front end, API, DB)
> * AWS infrastructure
>
> Do not use mermaid diagrams. Discuss the format for the diagrams.

**Format decision:** draw.io / diagrams.net XML (`.drawio` files), confirmed with David. Each
diagram is also exported to `.svg` so it can be viewed without the draw.io app, and embedded in a
README that explains what's shown.

## Description

Add two architecture diagrams to the repo under `docs/design/architecture/`:

1. **Logical structure** — FrontEnd (Vue SPA) → Api (.NET Core Web API) → DynamoDB, showing the
   browser client, auth/JWT flow, and the `IRepository<T>`/`DynamoDbRepository<T>` data access
   layer.
2. **AWS infrastructure** — derived from `Terraform/main.tf` and its modules:
   - `frontend` module: S3 bucket (private, SSE) + CloudFront distribution (OAC) + custom domain
   - `api` module: API Gateway v2 (HTTP API, custom domain) → Lambda (in VPC private subnets) →
     IAM role (VPC access + DynamoDB access), CloudWatch log group
   - `networking` module: VPC, private subnets, route table, NACLs, Lambda security group,
     DynamoDB VPC gateway endpoint
   - `data` module (x4): DynamoDB tables — User, TransactionMonth, TransactionDescriptions,
     DescriptionMapping
   - CI/CD: GitHub Actions deploying via OIDC-assumed AWS role (see UBE-22)

## Plan

1. Create `docs/design/architecture/` directory.
2. Build `logical-architecture.drawio` covering FrontEnd/Api/DynamoDB and the auth flow.
3. Build `aws-infrastructure.drawio` covering the Terraform-defined AWS resources above.
4. Export both diagrams to `.svg`.
5. Write `docs/design/architecture/README.md` explaining each diagram, embedding the SVGs, and
   linking the `.drawio` sources for editing.

## Checklist

- [x] Create worklog and branch
- [x] Confirm plan with David
- [x] Create `docs/design/architecture/` directory
- [x] Draft `logical-architecture.drawio`
- [x] Draft `aws-infrastructure.drawio`
- [x] Export diagrams to SVG
- [x] Write `docs/design/architecture/README.md`
- [x] Final review / mark issue done

## Session log

### Prompt 1

> start worklog for UBE-12

Fetched the Linear issue. It explicitly says not to use Mermaid and to discuss the diagram format
first, so asked David via AskUserQuestion — he chose draw.io/diagrams.net XML. Inspected
`Terraform/main.tf` and the `api`/`frontend`/`networking`/`data` modules to ground the AWS
infrastructure diagram in the actual resources rather than guessing. Created the branch
`UBE-12/create-basic-documentation` off `main` and this worklog.

### Prompt 2

> go

Read `Terraform/modules/{api,frontend,networking}/main.tf` to enumerate the actual AWS resources
(API Gateway v2, Lambda in VPC, IAM roles, CloudWatch logs, CloudFront + S3 with OAC, VPC/NACLs/SG,
DynamoDB gateway endpoint). Hand-authored `logical-architecture.drawio` and
`aws-infrastructure.drawio` under `docs/design/architecture/`. No draw.io CLI/app was available
locally to auto-export, so hand-authored matching `.svg` files with the same layout/content so the
diagrams are viewable without the draw.io app; validated all four files as well-formed XML with
`xmllint`. Wrote `docs/design/architecture/README.md` embedding both SVGs with explanations and
links to the editable `.drawio` sources.

### Prompts 3-7 — diagram review iterations

> the aws infra diagram is poor: / 1. remove the github stuff / remove the security group, IAM
> roles etc for the lamdba / remove the table names from dynamoDB / add icons for the AWS
> services... / the AWS icons you have on here are terrible. They're not AWS4 icons. / move the
> API Gateway to left of the VPC so that the line from the browser does not need to cross through
> the VPC to access this

Iterated on `aws-infrastructure.drawio`/`.svg` based on feedback: removed the GitHub
Actions/OIDC deploy nodes (out of scope for infra structure) and the Lambda security group/IAM
role boxes, tightening the layout each time to close the gaps left behind; dropped the DynamoDB
table name list from the box (kept in the README prose instead).

The first icon pass used guessed `mxgraph.aws4.*` draw.io stencil names plus hand-drawn SVG
glyphs as a fallback — called out as not real AWS icons. Fixed properly: downloaded the official
AWS Architecture Service icon set (S3, CloudFront, CloudWatch, VPC, Lambda, API Gateway,
DynamoDB) via the MIT-licensed `aws-icons` npm package, and embedded each as an inline base64
SVG image in both the `.drawio` and `.svg` files — renders identically and correctly in both
without depending on draw.io's shape library being available. Same icon added to the DynamoDB box
in `logical-architecture.drawio`/`.svg`.

Also re-laid-out `aws-infrastructure` so the browser→API Gateway arrow no longer crosses through
the VPC box: first attempt moved API Gateway up next to CloudFront (left of the VPC) with a
routed browser→API Gateway line, but that read worse, so redid it per explicit follow-up
direction — API Gateway now sits directly below the S3 bucket, in the same left-hand column,
still left of the VPC. Browser connects to it with one direct line, and API Gateway connects to
Lambda with one direct line entering the VPC boundary only there.

Follow-up: the gap between the left-hand column (CloudFront/S3/API Gateway) and the VPC was much
wider than the gaps elsewhere, and the request was for the whole diagram to be evenly spaced, not
just that one gap closed. Rebuilt the layout on a consistent 40px grid — same gap between every
adjacent pair of boxes (column stack, column→VPC, VPC internals, VPC→right-hand column) — and
shrank the page to fit, rather than just nudging the VPC leftward.

Removed every edge label (origin/HTTPS/invoke/private-route captions) and the "Not shown: ..."
footnote from `aws-infrastructure.drawio`/`.svg`, leaving the arrows themselves in place; shrank
the page height now that the footnote's vertical space isn't needed. The README's own "Not shown"
paragraph is untouched — that's written documentation, not diagram text.

