/** Preserve useful goal progress while keeping transport failures out of the UI. */
export function goalStatusNote(note:string){
 if(/(?:unexpected status |last status: |provider_http_|HTTP[ /])429\b|Too Many Requests|service_busy/i.test(note))return 'The service is busy. Your work is saved. Resume the goal in a moment.';
 if(/exceeded retry limit|unexpected status|https?:\/\/|127\.0\.0\.1/i.test(note))return 'A request could not be completed. Your work is saved. Try resuming the goal. If this continues, contact Sylvana support.';
 return note;
}
