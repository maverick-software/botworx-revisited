/** Archive readers validate their full sealed record before this lookup.
 * Only listed owners receive archived data. An authenticated account created
 * after recovery has no archived settings, images, files or layouts to apply. */
export function recoveryAccount<T extends {owner:string}>(accounts:readonly T[],owner:string):T|undefined{
 if(typeof owner!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(owner))throw Error('Invalid recovery account identity.');
 return accounts.find(account=>account.owner.toLowerCase()===owner.toLowerCase());
}
