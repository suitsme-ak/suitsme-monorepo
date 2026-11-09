import { env } from "cloudflare:workers";
import { accounts } from "../../../../lib/accounts";
export async function POST(request:Request){return accounts(request,env)}
