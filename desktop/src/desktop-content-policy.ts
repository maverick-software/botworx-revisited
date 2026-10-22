export function desktopContentPolicy(documentViewer:boolean){
 return documentViewer
  ?"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src data: blob:; font-src 'self' data: blob:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"
  :"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'none'; font-src 'self'; object-src 'none'; frame-src 'self'; base-uri 'none'; form-action 'none'";
}
