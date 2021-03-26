import { parse } from "./mod.ts";
import { BufReader } from "https://deno.land/std/io/bufio.ts";
import { assertThrowsAsync, assert } from "https://deno.land/std/testing/asserts.ts";
import { ServerRequest } from "https://deno.land/std/http/server.ts";

const   HDR_CONTENT_LENGTH='content-length',
        HDR_CONTENT_TYPE='content-type',
        HDR_VAL_UNKNOWN_TYPE='x-unknown-type',
        HDR_VAL_TEXT_PLAIN='text/plain',
        HDR_VAL_AUDIO_AAC='audio/aac',
        HDR_VAL_OCTET_STREAM='application/octet-stream',
        OPTIONS_SAVE_BODY_TO_FILE={saveBodyToFile: true},
        AAC_AUDIO_FILE_PATH='./testData/sample1.aac';

function addHeaders(req: ServerRequest, name: string, value: string|number): void {
    if(!req.headers)
        req.headers=new Headers();
    req.headers.set(name, `${value}`);
}

function encodeBody(input: string): BufReader {
    return new BufReader(new Deno.Buffer(new TextEncoder().encode(input)));
}

async function addBody(req: ServerRequest, ct: string, body: any, filePath?: string) {
    let len=0;
    addHeaders(req, HDR_CONTENT_TYPE, ct);
    if(filePath) {
        const fileContent=await Deno.readFile(filePath);
        req.r = new BufReader(new Deno.Buffer(fileContent));
        len=fileContent.length;
    }
    else if(typeof body === 'object') {
        const encBody=JSON.stringify(body);
        req.r = encodeBody(encBody);
        len=encBody.length;
    }        
    else if(typeof body === 'string') {
        len=body.length;
        req.r = encodeBody(body);
    }
    addHeaders(req, HDR_CONTENT_LENGTH, len);
}

Deno.test("empty req", () => {
    const req=new ServerRequest();
    assertThrowsAsync(() => parse(req), Error);
});

Deno.test("hdr: H1/V1", () => {
    const req=new ServerRequest();
    addHeaders(req, 'H1', 'V1');
    assertThrowsAsync( () => parse(req), Error);
});

Deno.test("cl=0", () => {
    const req=new ServerRequest();
    addHeaders(req, HDR_CONTENT_LENGTH, 0);
    assertThrowsAsync(() => parse(req), Error);
});

Deno.test("cl=0", () => {
    const req=new ServerRequest();
    addHeaders(req, HDR_CONTENT_LENGTH, 0);
    assertThrowsAsync(() => parse(req), Error);
});

Deno.test("cl=10, no ct", () => {
    const req=new ServerRequest();
    addHeaders(req, HDR_CONTENT_LENGTH, 10);
    assertThrowsAsync(() => parse(req), Error);
});

Deno.test("cl=10, ct=x-unknown-type, no body", async () => {
    const req=new ServerRequest();
    addHeaders(req, HDR_CONTENT_LENGTH, 10);
    addHeaders(req, HDR_CONTENT_TYPE, HDR_VAL_UNKNOWN_TYPE);
    const ret=await parse(req);
    assert(ret === undefined);
});

Deno.test("cl=4, ct=x-unknown-type, body=ABCD", async () => {
    const req=new ServerRequest();
    await addBody(req, HDR_VAL_UNKNOWN_TYPE, 'ABCD');
    const ret=await parse(req);
    assert(ret.constructor === Uint8Array);
    assert(ret.length === 4);
});

Deno.test("cl=4, ct=x-prop-type, body=ABCD, unknownAsText=true", async () => {
    const req=new ServerRequest();
    await addBody(req, HDR_VAL_UNKNOWN_TYPE, 'ABCD');
    const ret=await parse(req, {unknownAsText: true});
    assert(typeof ret === 'string');
    assert(ret.length === 4);
});

Deno.test("cl=4, ct=x-prop-type, body={}", async () => {
    const req=new ServerRequest();
    await addBody(req, HDR_VAL_UNKNOWN_TYPE, {});
    const ret=await parse(req);
    assert(ret.constructor === Uint8Array);
    assert(ret.length === 2);
});

Deno.test("cl=4, ct=text/plain, body=ABCD", async () => {
    const req=new ServerRequest();
    await addBody(req, HDR_VAL_TEXT_PLAIN, 'ABCD');
    const ret=await parse(req);
    assert(typeof ret === 'string');
    assert(ret.length === 4);
});

Deno.test("cl=9, ct=text/plain, body=123456789", async () => {
    const req=new ServerRequest();
    await addBody(req, HDR_VAL_TEXT_PLAIN, "123456789");
    const ret=await parse(req);
    assert(typeof ret === 'string');
    assert(ret.length === 9);
});

Deno.test("cl=9, ct=text/plain, body=123456789, sbtf", async () => {
    const req=new ServerRequest();
    await addBody(req, HDR_VAL_TEXT_PLAIN, "123456789");
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    assert(typeof ret === 'string');
    assert(ret.startsWith('./'));
    await Deno.remove(ret);
});

Deno.test(`cl=?, ct=audio/aac, body=${AAC_AUDIO_FILE_PATH}`, async () => {
    const req=new ServerRequest();
    await addBody(req, HDR_VAL_AUDIO_AAC, undefined, AAC_AUDIO_FILE_PATH);
    const ret=await parse(req);
    assert(ret.constructor === Uint8Array);
    const origFile=await Deno.readFile(AAC_AUDIO_FILE_PATH);
    assert(ret.length === origFile.length);
});

Deno.test(`cl=?, ct=audio/aac, body=${AAC_AUDIO_FILE_PATH}, sbtf`, async () => {
    const req=new ServerRequest();
    await addBody(req, HDR_VAL_AUDIO_AAC, undefined, AAC_AUDIO_FILE_PATH);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    assert(typeof ret === 'string');
    assert(ret.startsWith('./'));
    const origFile=await Deno.readFile(AAC_AUDIO_FILE_PATH);
    const gotFie=await Deno.readFile(ret);
    assert(gotFie.length === origFile.length);
    //await Deno.remove(ret);
});

Deno.test(`cl=?, ct=application/octet-stream, body=${AAC_AUDIO_FILE_PATH}`, async () => {
    const req=new ServerRequest();
    await addBody(req, HDR_VAL_OCTET_STREAM, undefined, AAC_AUDIO_FILE_PATH);
    const ret=await parse(req);
    assert(ret.constructor === Uint8Array);
    const origFile=await Deno.readFile(AAC_AUDIO_FILE_PATH);
    assert(ret.length === origFile.length);
});

Deno.test(`cl=?, ct=application/octet-stream, body=${AAC_AUDIO_FILE_PATH}, sbtf`, async () => {
    const req=new ServerRequest();
    await addBody(req, HDR_VAL_OCTET_STREAM, undefined, AAC_AUDIO_FILE_PATH);
    const ret=await parse(req, OPTIONS_SAVE_BODY_TO_FILE);
    assert(typeof ret === 'string');
    assert(ret.startsWith('./'));
    const origFile=await Deno.readFile(AAC_AUDIO_FILE_PATH);
    const gotFie=await Deno.readFile(ret);
    assert(gotFie.length === origFile.length);
    //await Deno.remove(ret);
});

