import { env } from "cloudflare:workers";
import { accounts } from "../../../../lib/accounts";
export async function GET(request:Request){return accounts(request,env)}
