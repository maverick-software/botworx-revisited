export type EditorDraft={id:string;referenceId:string;relativePath:string;name:string;canonicalPath:string;base:string|null;baseHash:string|null;content:string;revision:number;updatedAt:string};
export type EditorSnapshot={path:string;content:string|null;sha256:string|null};
export type EditorSave={draft:EditorDraft;conflict?:EditorSnapshot;saved?:boolean};
