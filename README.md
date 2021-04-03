# Universal body-parser for Deno

This is a universal body-parser for Deno that provides an easy interface to parse most of the common content types. The user need not worry at all about the content type. The only thing to be done is to pass the HTTP request object (`ServerRequest`) to a simple parse function and let it work the magic! The parse function returns the output in one of the four predefined formats:
 
- `raw`: Binary output
- `txt`: Text/string output
- `data`: Object output
- `files`: Uploaded files

 
## Simple usage
In the simplest form, the parse function can be invoked with only the `ServerRequest` object. If there is any error, headers are missing or malformed, the body is absent, malformed, or unparseable, etc, `undefined` would be returned.
 
```ts
import { parse } from "../mod.ts";
import { serve } from "https://deno.land/std/http/server.ts";
 
const server = serve({ hostname: "0.0.0.0", port: 8080 });
for await (const request of server) {
   const body=await parse(request);
   request.respond({ status: 200, body: body.txt});
}
``` 
```shell
curl http://localhost:8080
 
//undefined
 
curl http://localhost:8080 -H 'content-type: text/plain' -d "abcd"
 
//{ txt: "abcd" }
```
 
## Advanced usage
In the advanced form, the parse function takes a second optional argument that can be used either to control behavior or redirect the output:
 
Option | Type | Possible values | Default value | Usage
--- | --- | --- | --- | ---
`unknownAsText`|boolean|true, false|true|Treat all the unknown content types as binary
`xmlToJson`|boolean|true, false|true|Convert all XML content to JSON
`saveBodyToFile`|boolean|true, false|false|Save request body in a file
`saveFilePath`|string||`.`|The path where the body would be saved
 
The last two options would be very useful if the request body needs to be saved in a file. For example: if a video is uploaded, it might be better to save the video in a file rather than keeping it in memory. Using the `saveBodyToFile` option, any request body could be redirected to a file.
 
```ts
import { parse } from "../mod.ts";
import { serve } from "https://deno.land/std/http/server.ts";
 
const server = serve({ hostname: "0.0.0.0", port: 8080 });
for await (const request of server) {
   const body=await parse(request, {saveBodyToFile: true});
   request.respond({ status: 200, body: body.files.uploadedFile.name });
}
```
 
```shell
curl http://localhost:8080 --data-binary @testdata/sample.html -H 'content-type: text/html'
 
//{
 files: {
   uploadedFile: {
     name: "1kol365012q.html",
     size: 555,
     type: "text/html",
     path: "/Users/mayankc/Work/source/deno-body-parser/examples/1kol365012q.html"
   }
 }
}
```
 
## Output
As mentioned earlier, the output of the parser is always an object that contains either `raw`, `txt`, `json`, or `files`. The output depends on the content type. For example - mp3 gets treated as raw, text/plain gets treated as txt, and application/json gets treated as JSON.
 
Output type | Description
-- | --
`raw` | Binary output (audio/aac, application/gzip, etc.)
`txt` | Textual/string output (text/plain, text/html, etc.)
`data` | Json output (application/json, x-www-form-urlencoded, etc.)
`files` | Uploaded files (multipart/form-data, or body is explicitly saved into a file)
 
```shell
{ txt: "abcd" }
{ raw: Uint8Array(4) [ 97, 98, 99, 100 ] }
{ data: { a: "b" } }
{
 files: {
   uploadedFile: {
     name: "1kol365012q.html",
     size: 555,
     type: "text/html",
     path: "/Users/mayankc/Work/source/deno-body-parser/examples/1kol365012q.html"
   }
 }
}
```
 
 
## Supported Content Types
The universal parser recognizes a large number of content types. The following is the list of supported content types and how they are treated:
 
Content type | Output type
-- | --
audio/aac | `raw`
application/octet-stream | `raw`
application/x-bzip | `raw`
application/x-bzip2 | `raw`
text/csv | `txt`
application/msword | `raw`
application/vnd.openxmlformats-officedocument.wordprocessingml.document | `raw`
application/epub+zip | `raw`
application/gzip | `raw`
image/gif | `raw`
text/html | `txt`
image/jpeg | `raw`
application/json | `data`
audio/mpeg | `raw`
video/mp4 | `raw`
video/mpeg | `raw`
image/png | `raw`
application/pdf | `raw`
application/vnd.ms-powerpoint | `raw`
application/vnd.openxmlformats-officedocument.presentationml.presentation | `raw`
application/vnd.rar | `raw`
application/rtf | `raw`
image/svg+xml | `raw`
application/x-tar | `raw`
text/plain | `txt`
audio/wav | `raw`
application/vnd.ms-excel | `raw`
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | `raw`
application/zip | `raw`
x-www-form-urlencoded | `data`
text/xml | `txt` or `data`
multipart/form-data | `data`, `files`
 
Although the list is long, the content types are usually in one of the three categories:
 
- `textual`: text (strings)
- `data`: objects (JSON, urlencoded, form-data)
- `binary`: raw/binary data (audio, image, video, etc.)
 
The next three sections will go over the detailed handling of each of the three categories.
 
## Handling binary body
A binary body is something that can't be parsed, so needs to be handled as is. Some examples are mp3, png, jpeg, mpeg, zip, etc.
 
For binary bodies, the parse function returns the output in `raw`, unless the body has been redirected to a file.
 
```ts
const body=await parse(request);
if(!body)
   return request.respond({status: 400});
const resp=new TextEncoder().encode(body.raw.length)
request.respond({ status: 200, body: resp});
```
 
```shell
curl http://localhost:8080  --data-binary @testdata/sample.bin
8576
 
{
 raw: Uint8Array(8576) [
     0,  5,  83, 108, 105, 99, 107,  0,   0,  0,  0,   0,  0, 0,  0,
     0,  0,   0,   0,   0,  0,   0,  0,   0,  0,  0,   0,  0, 0,  0,
     0,  0,   0,   0,   0,  0,   0,  0,   0,  0,  0,   0,  0, 0,  0,
     0,  0,   0,   0,   0,  0,   0,  0,   0,  0,  0,   0,  0, 0,  0,
     0,  0,   0,   0,   0, 76,  87, 70,  78, 71, 87, 112, 49, 0,  0,
     0,  0,   0,   0,   0,  0,   0,  0,   0,  0,  0,   0,  0, 0, 32,
   162, 93, 235,   9, 186, 93, 235,  9, 186,  0,
   ... 8476 more items
 ]
}
```
 
Sometimes, binary bodies might just need to be saved into a file. For example - image upload to a local data store. The image is not required to be processed, so it can be sent to a local file directly.
 
```ts
const body=await parse(request, {saveBodyToFile: true});
let resp;
if(!body)
   resp=new TextEncoder().encode("No body received");
else if(body.files)
   resp=new TextEncoder().encode(body.files.uploadedFile.name);
request.respond({ status: 200, body: resp });
```
 
```shell
curl http://localhost:8080 -H 'content-type: image/png' --data-binary @./testdata/sample.png
 
{
 files: {
   uploadedFile: {
     name: "1d5zy3wx7g2.png",
     size: 23182,
     type: "image/png",
     path: "/Users/mayankc/Work/source/deno-body-parser/examples/1d5zy3wx7g2.png"
   }
 }
}
```
 
The file name is either taken from query param `filename` or `fileName`, or randomly generated. The file extension is decided by the content type.
 
## Handling textual body
A textual body is like strings containing textual data (neither object nor binary). Some examples are plain text data, HTML, CSV, etc.
 
The parse function is the same regardless of the type of body. The only difference is in the output. For textual bodies, the output comes in `txt`.
 
```ts
const body=await parse(request);
request.respond({ status: 200, body: body.txt});
```
 
```shell
curl http://localhost:8080 -H 'content-type: text/plain' -d
"abcd"
{ txt: "abcd" }
 
curl http://localhost:8080 -H 'content-type: text/plain' --data-binary @testdata/sample.txt
{
 txt: "Utilitatis causa amicitia est quaesita.\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Col..."
}
 
curl http://localhost:8080 -H 'content-type: text/html' --data-binary @testdata/sample.html
 
{
 txt: '<HTML>\n\n<HEAD>\n\n<TITLE>Your Title Here</TITLE>\n\n</HEAD>\n\n<BODY BGCOLOR="FFFFFF">\n\n<CENTER><IMG SRC="...'
}
```
 
The parsed body can be saved in a file. The file name will be randomly generated if there is no query parameter `filename` or `fileName` in the URL.
 
```ts
const body=await parse(request, {saveBodyToFile: true});
   if(!body)
       resp=new TextEncoder().encode("No body received");
   else if(body.files)
       resp=new TextEncoder().encode(body.files.uploadedFile.name);
   request.respond({ status: 200, body: resp });
```
 
```shell
curl http://localhost:8080 -H 'content-type: text/plain' -d "abcdefghijklmnopqrstuvwxyz"
 
{
 files: {
   uploadedFile: {
     name: "0x2r862b292h.txt",
     size: 26,
     type: "text/plain",
     path: "/Users/mayankc/Work/source/deno-body-parser/examples/0x2r862b292h.txt"
   }
 }
}
 
curl http://localhost:8080 -H 'content-type: text/html' --data-binary @testdata/sample.html
 
{
 files: {
   uploadedFile: {
     name: "setw7ue7o7q.html",
     size: 555,
     type: "text/html",
     path: "/Users/mayankc/Work/source/deno-body-parser/examples/setw7ue7o7q.html"
   }
 }
}
```
 
## Handling structured body
A structured body is one that has the data in a structured form that can be parsed into Javascript objects. For example - application/json can be directly converted to JS object. Similarly, urlencoded and a part of the multipart/form-data is also parsed into JS objects.
 
For structured bodies, the output comes in `data`.
 
### Json
A JSON body is directly parsed and then returned as a JS object.
 
```ts
const body=await parse(request);
let resp;
if(!body)
   resp=new TextEncoder().encode("No body received");
else if(body.data)
   resp=new TextEncoder().encode(JSON.stringify(body.data));
request.respond({ status: 200, body: resp });
```
 
```shell
curl http://localhost:8080 -H 'content-type: application/json' -d '{"a": "b"}'
{"a":"b"}
 
{ data: { a: "b" } }
```
 
Any malformed data is rejected:
 
```shell
curl http://localhost:8080 -H 'content-type: application/json' -d '{"a":}'
No body received
 
undefined
```
 
### URL-encoded
A URL encoded body is parsed into key-value pairs and then converted to a JS object. For the user, the output still comes in `data` as a JS object.
 
```shell
curl http://localhost:8080 -H 'content-type: x-www-form-urlencoded' -d 'a=b&c=d'
{"a":"b","c":"d"}
 
{ data: { a: "b", c: "d" } }
```
 
### Multipart/form-data
A multipart form data body is a bit complicated to parse as it could contain a mix of key-value pairs and files. The parser converts all the key-value pairs into a JS object and returns them in `data`. For files, the parser returns them in `files` object. If the total body size is less than 10M, the files would reside in memory, otherwise, they'd go into the disk.
 
Here is an example of multipart/form-data with simple fields (no files):
 
```ts
const body=await parse(request);
request.respond({status: 204});
```
 
```shell
curl http://localhost:8080 -F "a=b" -F "c=d"
> Content-Length: 228
> Content-Type: multipart/form-data; boundary=------------------------670360d70ae450ba
< HTTP/1.1 204 No Content
< content-length: 0
 
{ data: { a: "b", c: "d" } }
```
 
Here is an example of multipart/form-data with simple fields and two files. For both the files, the total size is less than 10M. Therefore, the files would reside in memory unless the user explicitly requests them to go on disk using `saveBodyToFile`.
 
```shell
2.0M testdata/sample.jpg
24K testdata/sample.png
 
curl http://localhost:8080 -F "a=b" -F "c=d" -F "file1=@./testdata/sample.jpg" -F "file2=@./testdata/sample.png"
 
{
 data: { a: "b", c: "d" },
 files: {
   file1: {
     name: "sample.jpg",
     type: "image/jpeg",
     size: 2107679,
     content: Uint8Array(2107679) [
       255, 216, 255, 224,  0,  16,  74,  70,  73, 70,  0,  1,  1,   1,   0,
        72,   0,  72,   0,  0, 255, 226,  12,  88, 73, 67, 67, 95,  80,  82,
        79,  70,  73,  76, 69,   0,   1,   1,   0,  0, 12, 72, 76, 105, 110,
       111,   2,  16,   0,  0, 109, 110, 116, 114, 82, 71, 66, 32,  88,  89,
        90,  32,   7, 206,  0,   2,   0,   9,   0,  6,  0, 49,  0,   0,  97,
        99, 115, 112,  77, 83,  70,  84,   0,   0,  0,  0, 73, 69,  67,  32,
       115,  82,  71,  66,  0,   0,   0,   0,   0,  0,
       ... 2107579 more items
     ]
   },
   file2: {
     name: "sample.png",
     type: "image/png",
     size: 23182,
     content: Uint8Array(23182) [
       137,  80,  78,  71,  13,  10,  26,  10,   0,   0,   0,  13,  73,  72,  68,
        82,   0,   0,   1, 110,   0,   0,   0, 228,   8,   6,   0,   0,   0, 184,
       254, 206, 133,   0,   0,  32,   0,  73,  68,  65,  84, 120, 156, 236, 189,
       121, 148, 100, 217,  93, 223, 249, 185,  47, 246,  61,  35, 114, 223, 106,
       175, 234, 174, 234, 170, 174, 238,  86, 107,  69,   2, 201,  88,  44,   3,
       102,  24, 121, 193, 194, 198,  28,  27,  24,  96, 198,  24, 219, 140, 144,
        89,  60, 216, 178, 132,   7, 236, 193,  62, 204,
       ... 23082 more items
     ]
   }
 }
}
```
 
As expected, there are two types of data present in the parsed body:
 
- `data`: Containing the simple fields of form data
- `files`: Containing the file uploads present in form data
 
The files were in memory because their size was less than 10M. They can be saved on disk using the same option `saveBodyIntoFile`.
 
```ts
const body=await parse(request, {saveBodyToFile: true, saveFilePath: '/private/var/tmp'});
request.respond({status: 201});
```
 
```shell
curl http://localhost:8080 -F "a=b" -F "c=d" -F "file1=@./testdata/sample.jpg" -F "file2=@./testdata/sample.png"
 
{
 files: {
   file1: {
     name: "sample.jpg",
     type: "image/jpeg",
     size: 2107679,
     path: "/private/var/tmp/sample.jpg"
   },
   file2: {
     name: "sample.png",
     type: "image/png",
     size: 23182,
     path: "/private/var/tmp/sample.png"
   },
   uploadedFile: {
     name: "rhzn80es5ne.json",
     size: 17,
     type: "application/json",
     path: "/private/var/tmp/rhzn80es5ne.json"
   }
 }
}
```
All the parts present in the multipart body have been saved into files at the mentioned path `/private/var/tmp`.

## More examples
Some more examples are present [here](./examples)
 
## Suggestions or issues
Please open a ticket for any suggestions or issues. They'll be addressed as soon as possible.
 

