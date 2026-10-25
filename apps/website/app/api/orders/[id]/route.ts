import { env } from "cloudflare:workers";
import { commerce } from "../../../../lib/commerce";
export async function GET(request:Request){return commerce(request,env)}
export async function POST(request:Request){return commerce(request,env)}
