import {desktopOperation} from './operation-lock.mjs';
import {closed,run} from './phased-backup-control.mjs';
desktopOperation('activate verified UI-only menu correction with rollback');
await closed();console.log(await run(['-d','AgentopiaRuntime-a91a4800-e08f-4440-a4ec-588762d01bfd','-u','agentopia','--exec','python3','/mnt/d/Users/charl/software/Agentopia/scripts/desktop/apply-menu-viewer-ui-hotfix.py'],180000));
