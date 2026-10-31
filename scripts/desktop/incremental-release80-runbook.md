# Qualify the backend correction over the already-upgraded QA profile

Run only after the reliability agent has normally closed QA and released its ownership. This standalone controller does not stop another process, restore a database, change a schema marker, or repeat the completed79-to80 upgrade.

Prepare candidate2 with the unchanged prepare-release80.mjs after merging the scheduler/Broker correction. Run `node scripts/desktop/qualify-incremental-release80.mjs <new-package-proof.json>`. The accepted initial candidate is fixed at desktop-release80/1792983634749. Both candidates must share accepted79 ancestry; every SQL/runtime/UI/resource byte and every program/native file outside app.asar must match. Only broker.js and task-scheduler.js may differ in compiled output.

The controller verifies the original upgrade qualification, warm/cold evidence and complete original upgrade backup. It opens the old exact packaged candidate under the existing isolated probe and captures one fresh complete Runtime backup inside the existing Broker maintenance fence, then normally closes it. It opens the new candidate warm and cold, compares every original application/account/Vault row to that fresh backup with the strict empty service policy, compares protected bindings and settings, and checks saved request/message fingerprints for replay. The existing QA schema marker stays80/schema88 throughout.

The resulting qualification composes the original automatic upgrade/backup proof with the fresh incremental comparison and cold reopen evidence. It records current hashes of all existing qualified delivery controllers, itself and the actual runtime-outage qualifier. Only successful qualification publishes the new upgrade-current pointer. Run the separate actual outage/recovery qualifier against this exact corrected candidate before installation.

Source checks use `node --test scripts/desktop/test-incremental-release80.cjs`. Preparing this controller runs only those controlled guard fixtures and syntax checks; it does not launch QA or mutate production.
