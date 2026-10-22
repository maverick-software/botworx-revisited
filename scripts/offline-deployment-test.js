"use strict";
// Offline Deployment Test Script
// This script simulates the deployment process without requiring a public API URL
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var dotenv_1 = __importDefault(require("dotenv"));
var digitalocean_service_1 = require("../src/services/digitalocean_service");
var crypto_1 = __importDefault(require("crypto"));
var promises_1 = __importDefault(require("fs/promises"));
// Load environment variables
dotenv_1.default.config();
// Configuration
var TEST_AGENT_ID = process.env.TEST_AGENT_ID || 'test-agent-1';
var DO_API_TOKEN = process.env.DO_API_TOKEN;
var DTMA_GIT_REPO_URL = process.env.DTMA_GIT_REPO_URL || 'https://github.com/maverick-software/dtma-agent.git';
// Constants
var MAX_POLL_ATTEMPTS = 30;
var POLL_INTERVAL_MS = 10000;
// Validate required environment variables
if (!DO_API_TOKEN) {
    console.error('ERROR: DO_API_TOKEN environment variable is required');
    process.exit(1);
}
if (!DTMA_GIT_REPO_URL) {
    console.error('ERROR: DTMA_GIT_REPO_URL environment variable is required');
    process.exit(1);
}
// Create user data script with offline mode
function createOfflineUserDataScript() {
    var dtmaAuthToken = crypto_1.default.randomBytes(32).toString('hex');
    var repoUrl = DTMA_GIT_REPO_URL;
    var branch = process.env.DTMA_GIT_BRANCH || 'main';
    console.log("Using DTMA repository: ".concat(repoUrl, " (branch: ").concat(branch, ")"));
    console.log("Generated DTMA auth token: ".concat(dtmaAuthToken));
    console.log('NOTE: Save this token for connecting to the DTMA later\n');
    // This script sets up the DTMA but configures it for offline mode
    return "#!/bin/bash\nset -e\nset -x\n\n# --- Log File Setup ---\nLOG_FILE=\"/var/log/dtma-bootstrap.log\"\ntouch \"${LOG_FILE}\"\nchown \"ubuntu\":\"ubuntu\" \"${LOG_FILE}\"\nexec &> >(tee -a \"${LOG_FILE}\")\n\n# --- Variables ---\nAGENTOPIA_DIR=\"/opt/agentopia\"\nDTMA_DIR=\"${AGENTOPIA_DIR}/dtma\"\nDTMA_CONFIG_FILE=\"/etc/dtma.conf\"\nDTMA_SERVICE_FILE=\"/etc/systemd/system/dtma.service\"\nNODE_VERSION=\"20\"\nDTMA_AUTH_TOKEN_VALUE=\"".concat(dtmaAuthToken, "\"\nDTMA_REPO_URL=\"").concat(repoUrl, "\"\nDTMA_BRANCH=\"").concat(branch, "\"\nRUN_USER=\"ubuntu\"\nOFFLINE_MODE=\"true\"\n\nexport DEBIAN_FRONTEND=noninteractive\n\necho \"--- Starting DTMA Setup Script (OFFLINE MODE) ---\"\n\n# --- Install Prerequisites ---\necho \"Installing prerequisites...\"\napt-get update -y\napt-get install -y apt-transport-https ca-certificates curl software-properties-common git gpg\n\n# Install Docker\necho \"Installing Docker...\"\nmkdir -p /etc/apt/keyrings\ncurl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg\necho \\\n  \"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \\\n  $(lsb_release -cs) stable\" | tee /etc/apt/sources.list.d/docker.list > /dev/null\napt-get update -y\napt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin\n\n# Add user to docker group\necho \"Adding user ${RUN_USER} to Docker group...\"\nusermod -aG docker \"${RUN_USER}\" || echo \"Warning: Failed to add user ${RUN_USER} to docker group.\"\n\n# Install Node.js\necho \"Installing Node.js v${NODE_VERSION}...\"\ncurl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -\napt-get install -y nodejs\n\n# --- Configure DTMA ---\necho \"Creating DTMA config file at ${DTMA_CONFIG_FILE}...\"\nmkdir -p \"$(dirname \"${DTMA_CONFIG_FILE}\")\"\nchown \"${RUN_USER}\":\"${RUN_USER}\" \"$(dirname \"${DTMA_CONFIG_FILE}\")\"\n\necho \"DTMA_AUTH_TOKEN=${DTMA_AUTH_TOKEN_VALUE}\" > \"${DTMA_CONFIG_FILE}\"\necho \"OFFLINE_MODE=${OFFLINE_MODE}\" >> \"${DTMA_CONFIG_FILE}\"\necho \"# No AGENTOPIA_API_BASE_URL in offline mode\" >> \"${DTMA_CONFIG_FILE}\"\nchmod 600 \"${DTMA_CONFIG_FILE}\"\nchown \"${RUN_USER}\":\"${RUN_USER}\" \"${DTMA_CONFIG_FILE}\"\n\n# --- Fetch and Build DTMA Code ---\necho \"Cloning DTMA repository from ${DTMA_REPO_URL} branch ${DTMA_BRANCH}...\"\nmkdir -p \"${AGENTOPIA_DIR}\"\nchown \"${RUN_USER}\":\"${RUN_USER}\" \"${AGENTOPIA_DIR}\"\n\n# Clone the repository\necho \"Attempting to clone as user ${RUN_USER}...\"\nsudo -u \"${RUN_USER}\" git clone --branch \"${DTMA_BRANCH}\" \"${DTMA_REPO_URL}\" \"${DTMA_DIR}\"\n\nif [ -d \"${DTMA_DIR}\" ]; then\n  cd \"${DTMA_DIR}\"\n  echo \"Current directory: $(pwd)\"\n  echo \"Listing directory contents:\"\n  ls -la\n  \n  # Insert offline mode modifications\n  echo \"Modifying DTMA for offline mode...\"\n  cat <<EOF > \"${DTMA_DIR}/offline-mode.js\"\n// Offline mode support patch\n// This file is added during bootstrap to support offline mode testing\nimport fs from 'fs';\n\nexport function isOfflineMode() {\n  try {\n    const config = fs.readFileSync('/etc/dtma.conf', 'utf8');\n    return config.includes('OFFLINE_MODE=true');\n  } catch (err) {\n    console.error('Error reading config:', err);\n    return false;\n  }\n}\n\nexport function logApiCall(endpoint, data) {\n  console.log(`[OFFLINE] Would call API endpoint: ${endpoint}`);\n  console.log(`[OFFLINE] With data: ${JSON.stringify(data, null, 2)}`);\n  return { success: true, message: 'Offline mode - API call simulated' };\n}\nEOF\n\n  # Patch agentopia_api_client.ts to use offline mode\n  echo \"Patching API client for offline mode...\"\n  sed -i '1s/^/import { isOfflineMode, logApiCall } from \"./offline-mode.js\";\n/' \"${DTMA_DIR}/src/agentopia_api_client.ts\"\n  sed -i 's/export async function sendHeartbeat/export async function sendHeartbeat/' \"${DTMA_DIR}/src/agentopia_api_client.ts\"\n  sed -i '/export async function sendHeartbeat/,/^}/{ s/const response = await axios.post/if (isOfflineMode()) {\n    return logApiCall(\"/heartbeat\", payload);\n  }\n  const response = await axios.post/; }' \"${DTMA_DIR}/src/agentopia_api_client.ts\"\n  \n  echo \"Installing DTMA dependencies as user ${RUN_USER}...\"\n  sudo -u \"${RUN_USER}\" bash -c \"cd ${DTMA_DIR} && npm install --production --unsafe-perm\"\n  \n  echo \"Building DTMA as user ${RUN_USER}...\"\n  sudo -u \"${RUN_USER}\" bash -c \"cd ${DTMA_DIR} && npm run build\"\n  \n  echo \"Ensuring ${DTMA_DIR} is owned by ${RUN_USER} post-build...\"\n  chown -R \"${RUN_USER}\":\"${RUN_USER}\" \"${DTMA_DIR}\"\nelse\n  echo \"Error: Failed to clone DTMA repository into ${DTMA_DIR}.\" >&2\n  exit 1\nfi\n\n# --- Set up systemd Service ---\necho \"Creating systemd service file ${DTMA_SERVICE_FILE}...\"\ncat <<EOF > \"${DTMA_SERVICE_FILE}\"\n[Unit]\nDescription=Agentopia Droplet Tool Management Agent (Offline Mode)\nAfter=network.target docker.service\nRequires=docker.service\n\n[Service]\nEnvironmentFile=${DTMA_CONFIG_FILE}\nWorkingDirectory=${DTMA_DIR}\nExecStart=/usr/bin/node dist/index.js\nRestart=always\nUser=${RUN_USER}\nStandardOutput=journal\nStandardError=journal\nSyslogIdentifier=dtma\n\n[Install]\nWantedBy=multi-user.target\nEOF\n\n# --- Enable and Start Service ---\necho \"Enabling and starting DTMA service...\"\nsystemctl daemon-reload\nsystemctl enable dtma.service\nsystemctl start dtma.service\n\necho \"--- DTMA setup complete (OFFLINE MODE) ---\"\necho \"Authentication token: ").concat(dtmaAuthToken, "\"\necho \"Note: This is an offline deployment for testing purposes only!\"\n");
}
function provisionOfflineTestDroplet() {
    return __awaiter(this, void 0, void 0, function () {
        var uniqueDropletName, userDataScript, dropletConfig, dropletResponse, attempts, currentDropletState, pollError_1, publicIpV4, dropletInfo, _a, _b, error_1;
        var _c, _d;
        return __generator(this, function (_e) {
            switch (_e.label) {
                case 0:
                    console.log("Starting offline test deployment for agent: ".concat(TEST_AGENT_ID));
                    console.log('This will create a real DigitalOcean droplet but configure DTMA in offline mode');
                    console.log('No public API URL is required for this test');
                    uniqueDropletName = "agent-".concat(TEST_AGENT_ID, "-env-").concat(Date.now().toString().slice(-6));
                    console.log("\nDroplet name: ".concat(uniqueDropletName));
                    userDataScript = createOfflineUserDataScript();
                    dropletConfig = {
                        name: uniqueDropletName,
                        region: process.env.DO_DEFAULT_REGION || 'nyc3',
                        size: process.env.DO_DEFAULT_SIZE || 's-1vcpu-1gb',
                        image: process.env.DO_DEFAULT_IMAGE || 'ubuntu-22-04-x64',
                        ssh_keys: ((_c = process.env.DO_DEFAULT_SSH_KEY_IDS) === null || _c === void 0 ? void 0 : _c.split(',').map(function (id) { return id.trim(); }).filter(function (id) { return id; })) || [],
                        tags: ['agent-tool-environment', "agent:".concat(TEST_AGENT_ID), 'offline-mode'],
                        user_data: userDataScript,
                        ipv6: false,
                        monitoring: true,
                        with_droplet_agent: true,
                    };
                    if (dropletConfig.ssh_keys.length === 0) {
                        console.warn('\nWARNING: No SSH keys specified. You will not be able to SSH into the droplet.');
                        console.warn('Add SSH keys to your DigitalOcean account and specify them in DO_DEFAULT_SSH_KEY_IDS.\n');
                    }
                    console.log('\nStarting droplet creation with configuration:');
                    console.log("Region: ".concat(dropletConfig.region));
                    console.log("Size: ".concat(dropletConfig.size));
                    console.log("Image: ".concat(dropletConfig.image));
                    console.log("Tags: ".concat(dropletConfig.tags.join(', ')));
                    console.log('\nProvisioning droplet...');
                    _e.label = 1;
                case 1:
                    _e.trys.push([1, 15, , 16]);
                    return [4 /*yield*/, (0, digitalocean_service_1.createDigitalOceanDroplet)(dropletConfig)];
                case 2:
                    dropletResponse = _e.sent();
                    console.log("\nDigitalOcean droplet creation initiated:");
                    console.log("ID: ".concat(dropletResponse.id));
                    console.log("Name: ".concat(dropletResponse.name));
                    console.log("Initial status: ".concat(dropletResponse.status));
                    // Save droplet ID to file for reference
                    return [4 /*yield*/, promises_1.default.writeFile('./offline-droplet-info.json', JSON.stringify({
                            agent_id: TEST_AGENT_ID,
                            droplet_id: dropletResponse.id,
                            droplet_name: dropletResponse.name,
                            created_at: new Date().toISOString(),
                        }, null, 2))];
                case 3:
                    // Save droplet ID to file for reference
                    _e.sent();
                    console.log("\nDroplet info saved to offline-droplet-info.json");
                    // Poll for active status
                    console.log('\nPolling for droplet to become active...');
                    attempts = 0;
                    currentDropletState = dropletResponse;
                    _e.label = 4;
                case 4:
                    if (!(attempts < MAX_POLL_ATTEMPTS && currentDropletState.status !== 'active')) return [3 /*break*/, 10];
                    attempts++;
                    console.log("Polling attempt ".concat(attempts, "/").concat(MAX_POLL_ATTEMPTS, ". Current status: ").concat(currentDropletState.status));
                    // Wait for poll interval
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, POLL_INTERVAL_MS); })];
                case 5:
                    // Wait for poll interval
                    _e.sent();
                    _e.label = 6;
                case 6:
                    _e.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, (0, digitalocean_service_1.getDigitalOceanDroplet)(currentDropletState.id)];
                case 7:
                    // Check droplet status
                    currentDropletState = _e.sent();
                    return [3 /*break*/, 9];
                case 8:
                    pollError_1 = _e.sent();
                    console.error("Error polling droplet status:", pollError_1);
                    return [3 /*break*/, 10];
                case 9: return [3 /*break*/, 4];
                case 10:
                    if (!(currentDropletState.status === 'active')) return [3 /*break*/, 13];
                    console.log("\nDroplet is now active!");
                    publicIpV4 = (_d = currentDropletState.networks.v4
                        .find(function (net) { return net.type === 'public'; })) === null || _d === void 0 ? void 0 : _d.ip_address;
                    console.log("\n============ DEPLOYMENT SUCCESSFUL ============");
                    console.log("Droplet ID: ".concat(currentDropletState.id));
                    console.log("IP Address: ".concat(publicIpV4 || 'Not available'));
                    console.log("Status: ".concat(currentDropletState.status));
                    console.log("\nTo check DTMA status:");
                    console.log("1. Wait 3-5 minutes for bootstrap script to complete");
                    console.log("2. Run: node scripts/check-dtma-status.js ".concat(publicIpV4 || '<IP_ADDRESS>'));
                    console.log("\nTo SSH into the droplet (if SSH keys are configured):");
                    console.log("ssh ubuntu@".concat(publicIpV4 || '<IP_ADDRESS>'));
                    console.log("\nTo clean up when finished:");
                    console.log("node scripts/deprovision-test-droplet.js ".concat(currentDropletState.id));
                    console.log("==============================================");
                    _b = (_a = JSON).parse;
                    return [4 /*yield*/, promises_1.default.readFile('./offline-droplet-info.json', 'utf8')];
                case 11:
                    dropletInfo = _b.apply(_a, [_e.sent()]);
                    dropletInfo.ip_address = publicIpV4;
                    dropletInfo.status = currentDropletState.status;
                    return [4 /*yield*/, promises_1.default.writeFile('./offline-droplet-info.json', JSON.stringify(dropletInfo, null, 2))];
                case 12:
                    _e.sent();
                    return [3 /*break*/, 14];
                case 13:
                    console.error("\nDroplet did not become active after ".concat(attempts, " polling attempts."));
                    console.error("Last status: ".concat(currentDropletState.status));
                    console.error("Check the DigitalOcean console for more information.");
                    _e.label = 14;
                case 14: return [3 /*break*/, 16];
                case 15:
                    error_1 = _e.sent();
                    console.error("\nError deploying test droplet:", error_1);
                    return [3 /*break*/, 16];
                case 16: return [2 /*return*/];
            }
        });
    });
}
// Execute the offline test deployment
provisionOfflineTestDroplet();
