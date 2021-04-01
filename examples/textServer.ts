import { parse } from "../mod.ts";
import { serve } from "https://deno.land/std/http/server.ts";

const server = serve({ hostname: "0.0.0.0", port: 8080 });
for await (const request of server) {
    let body;
    try {
        body=await parse(request);
    } catch(err) {
        console.log(err.message);
        body="No body";
    }
    console.log(body);

    request.respond({ status: 200, body: body.txt });
}
  

