import type {SupabaseClient} from '@supabase/supabase-js';
import type {PluginPackage} from './plugin-contracts';
import {pluginDigest,bundledPlugins} from './plugin-validation';
import {legacyBrand,legacySlug} from './legacy-brand';

// Migrate owned declarations while retaining grants, enablement, vault IDs,
// MCP connection IDs and all user-authored instructions or documents.
export async function migrateBrandPlugins(db:SupabaseClient,owner:string){
 const result=await db.from('desktop_plugins').select('name,package,digest,source').eq('user_id',owner);
 if(result.error)throw Error('Saved plugin declarations could not be checked.');
 for(const row of result.data??[]){
  const extension=row.package?.manifest?.extensions?.['com.'+legacySlug];if(!extension)continue;
  if(pluginDigest(row.package)!==row.digest)throw Error('A retained plugin declaration failed its integrity check.');
  const name=row.name.startsWith(legacySlug+'-')?'sylvana'+row.name.slice(legacySlug.length):row.name;
  const pinned=row.source==='bundled'?bundledPlugins.find(pkg=>pkg.manifest.name===name):undefined;
  const pkg:PluginPackage=pinned??structuredClone(row.package);
  if(!pinned){
   const extensions=pkg.manifest.extensions!;extensions['com.sylvana']=extensions['com.'+legacySlug];delete extensions['com.'+legacySlug];pkg.manifest.name=name;
   const own=extensions['com.sylvana'];if(typeof own?.managedMcp==='string'&&own.managedMcp.startsWith(legacySlug+'-'))own.managedMcp='sylvana'+own.managedMcp.slice(legacySlug.length);
   if(row.source==='bundled'&&pkg.manifest.author?.name===legacyBrand)pkg.manifest.author.name='Sylvana';
  }
  const migrated=await db.rpc('desktop_rebrand_package',{p_user:owner,p_name:row.name,p_expected:row.digest,p_new_name:name,p_package:pkg,p_digest:pluginDigest(pkg)});
  if(migrated.error)throw Error('Saved plugin connections could not be migrated safely.');
 }
}
