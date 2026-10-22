// Embedded only in trusted checks executed in the isolated browser world.
// Walk the composed tree so slots and nested shadow roots retain their actual
// input target, while every containing host must also pass hit/focus checks.
export const browserDomChecks=String.raw`
 function shadowHost(root){try{return Object.getOwnPropertyDescriptor(ShadowRoot.prototype,'host').get.call(root);}catch{return null;}}
 function composedContains(target,node){
  for(let depth=0;node&&depth<256;depth++){
   if(node===target)return true;
   node=node.assignedSlot||node.parentNode||shadowHost(node);
  }
  return false;
 }
 function targetHit(target,x,y){
  for(let depth=0;target&&depth<64;depth++){
   const root=Node.prototype.getRootNode.call(target);
   if(root===document)return composedContains(target,Document.prototype.elementFromPoint.call(root,x,y));
   const host=shadowHost(root);if(!host||!composedContains(target,ShadowRoot.prototype.elementFromPoint.call(root,x,y)))return false;
   target=host;
  }
  return false;
 }
 function targetFocused(target){
  for(let depth=0;target&&depth<64;depth++){
   const root=Node.prototype.getRootNode.call(target);
   if(root===document)return root.activeElement===target;
   const host=shadowHost(root);if(!host||root.activeElement!==target)return false;
   target=host;
  }
  return false;
 }
`;
export const hitTargetFunction=String.raw`function(x,y){${browserDomChecks}return targetHit(this,x,y);}`;
export const focusedTargetFunction=String.raw`function(){${browserDomChecks}return targetFocused(this);}`;
