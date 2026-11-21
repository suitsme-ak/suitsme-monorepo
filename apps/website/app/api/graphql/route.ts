import { env } from "cloudflare:workers";
import { fabricGraphql } from "../../../lib/fabric-graphql";
export async function GET(request: Request) {
  return fabricGraphql(request, env);
}
export async function POST(request: Request) {
  return fabricGraphql(request, env);
}
