// PostgreSQL JSON text cannot contain NUL or unpaired UTF-16 surrogates. Native
// command output can contain either. Preserve files and the in-memory receipt;
// replace only invalid text code points in the database snapshot.
export function nativeJson<T>(value:T):T{
 return JSON.parse(JSON.stringify(value,(_key,item)=>typeof item==='string'?item.replace(/\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,'\uFFFD'):item)) as T;
}
