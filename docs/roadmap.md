
## Priorities ##

Adding Voice, Creating Admin Agent Repository, A Simple AI description to create an agent

## ✅ Contextual Awareness ## (COMPLETE - Oct 20, 2025)

**IMPLEMENTED!** Added a contextual awareness layer that runs before intent classification to understand what the user is ACTUALLY asking for in the context of chat history and summary.

**What was built:**
- `contextual-awareness.ts` - Analyzes user message in full conversation context
- Resolves implicit references ("it", "them", "him" → actual entities)
- Fetches conversation summary and agent personality
- Provides interpreted meaning + user intent + confidence
- ~200-500ms analysis using `gpt-4o-mini` with 5-min caching
- Integrated into `handlers.ts` as Step 1.5 (before intent classification)
- Contextual guidance injected into LLM prompt for accurate responses

**Documentation:** `docs/features/contextual_awareness/`

**Example:** User says "Send him an email" after discussing John Doe → Agent understands "Send email to John Doe"

## Powerpoint ##

## Spreadsheets ##

## OpenAI and Claude SDK ##

## Automated Agent Builder ##

## Gofr Agent A2A ##

## Quizzes or Exams ##

The Gofr Agent should be able to speak to the other agents as if they were MCP tools, essentially. The Google A2A protocol. Should be able to achieve this with OpenAI Agent SDK too.

## Message Functions - Docs ##

Would be interesting to add a doc icon to the bottom of message and allow users to generate a document from that specific message.

## Deep Research Capabilities ##

I want users to be able to select 'Deep Research'  from the input area of the agent chat page. This is like an 'enable/disable' toggle. They click it, and it enables the mode. This would cause the agent to, instead of using its assigned LLM model, use the o4-mini-deep-research model, which should use background mode to operate in. When the client enables deep research, they should be notified that cost is significantly higher than standard rates. 

https://platform.openai.com/docs/models/o4-mini-deep-research
https://platform.openai.com/docs/guides/deep-research
Background Mode: https://platform.openai.com/docs/guides/background

## Vision ##

We want users to be able to submit images via chat to agents. They can use the file open tool on the chat input or they can drag and drop the image into the chat area. The responses API automatically supports this for the OpenAI models we have selected, so we just need to make sure we update our responses API and UI to handle sending images to the LLM. 

https://platform.openai.com/docs/guides/images-vision?api-mode=responses#calculating-costs

## Edit Message ##

We want to be able to edit messages and start the chat from that point forward.

## Clone Chat ##

We want to be able to clone chats from specific checkpoint (every agent message and back) the same way we do in Cursor.

## Like/Dislike Tracker ##

We need to be able to track bad responses to help refine agent prompts. We want to track these for individual agents, and make this available via the admin page. Where we can view agents, their system prompts, how many messages they've produced, and how many likes/dislikes. Getting percentages and reports on their accuracy and capabilities.

## AI Video Conferencing ##

Ability for agent to start an AI video conference using D-ID realtime streaming. These can be in platform, or they can be made public links so they can be sent to others. The entire video, including the agent and the participants must be transcribed using OpenAI Whisper or another technology, and saved in the database as an artifact. We will need a video conferences table that stores conference ID with a link to the conversation ID they took place in. The transcripts must then be made available in that conversation for the agent to use as context. Transcripts become artifacts in our existing artifact system, so they can be used again later .

## Agent 2 Agent Job Queue ##

Sometimes an agent will not have the tools for a specific job. It would be good to create a system where, if the agent doesn't have the tools, it has access to a job queue MCP tool that allows it to send a request to a sort of 'Task Master' agent or queue. The Task Master would then review all available agents and their toolsets/capabilities, and send a request to that agent to see if it can perform the task. If the agent responds affirmatively and completes the request, the Task Master will receive the information and provide it back to the original agent. Otherwise, the Task Master can respond back with a list of agents who might be able to complete that task, or that it could not find any agents for that task.

## Agent Tagging ##

We need to add agent contact tab into the settings modal for agents. This way we can grant permissions for agents to speak with each other. If agents are enabled for another agent, then the user can tag an agent within another agent's chat. The agent also becomes aware of the other agents and their tools via Google's A2A protocol, and can tag them in a chat for help with a task or request.

## Chat Summary ## ✅ PHASE 1 COMPLETE (Oct 6, 2025)

**Status**: Foundation deployed to cloud - automatic summarization active!

Rather than having our message history sent to the agent every time we send a message, I would rather have the agent maintain a conversation summary board, where it updates its board as the conversation itself updates. This would operate as a sort of background agent independent of the agent itself and run asynchronously from the user/agent chat session. The conversation history can become available for the agent via MCP tools and a vector search. We can save the chat history for posterity in the existing way, but for our 'working memory' for the agent, it would be better to offer the agent a conversation history search tool to use that used vector-based similarity search rather than just dumping 25 previous messages. We already have a long-term memory vector-based search using pinecone--let's investigate and find out if we can supabase pg_vector for this working memory system. Research and report on how this can work.

https://cursor.com/docs/agent/chat/summarization

## Plans and Pricing ##

We need to figure out a pricing modal for this system and create a plan management system for it that we can manage on the admin side of the platform.

## Remove Integrations Page ##

We need to remove the integrations page and leave to the admin side. All integrations should be handled via the agent chat interface. The admin page will allow us to enable/disable integrations.

## Plan Management ##

This page needs to be turned into a pop up modal so the user does not need to leave the main chat interface. Everything about the platform should feel like the person is connected to the agents directly, with all external items being secondary.

## Memory Storage System Upgrade ##

As of now, every conversation is being processed and implemented for our knowledge graph and pinecone index. This is not efficient and will result in large databases with mostly useless information. Instead, let's separate memory storage from the chat functionality, and build it as background process for determining what should qualify as 'memorable' and what shouldn't. 

Here are a few metrics we can use: our background process can determine whether or not the conversation, research, etc. is related to the core purpose of the agent (which it can find in it's own name and description). If it is not, for example, let's say someone asks a gmail agent about the color of the sky. This is not applicable to a gmail agent's explicit memory, and it does not get stored. If the user asks a question about a process related to the agents core function, for example, let's say the CEO asks an HR agent about current HR laws, and the agent had to perform web research, then that conversation would be processed for storage. 

Specifically, we want to store memories that are related to expertise, systems, processes and procedures or entities within the business itself (agents, humans, etc.). This will improve awareness over time. These should processed for the explicit memory as episodic memories for vector, and separately semantic understanding for the knowledge graph. We already have these systems built, we just need to add these additional features, and ensure that the background processes for memory storage are not interrupting or slowing down our agentic chat sessions.

## Prompt Library ##

We need to be able to save prompts with custom variables. They become forms with input fields, dropdowns, etc. Then they become reusable. They can be used independently and open a new system agent chat (Gofr), or they can be called in an agent chat via the # symbol.

## Artifacts ##

Agents needs to be able to create word documents, PDFs, text files (with various extensions) and html pages.' These artifacts should be shown on the Library page as their own tab. Artifacts can be shared with other agents and other accounts as well, or inside of teams.

## Canvas ##

Users need to be able to work with agents inside a canvas, allowing them to work on a single artifact, making edits themselves, or having the agent make edits. The user needs to be able to highlight areas, drag them into the chat similar to how Cursor does for specific edits. Then, from the Canvas, the user can instruct the agent to generate any file type from it, if it is the right type of project. If it is a text project, they can generate a Word Document (.docx), PDF (.pdf), Markdown (.md) etc. If it is a code project, they can produce TypeScript, JavaScript, Python files, etc.

We can have spreadsheet project, text project, code project (any other kinds of projects??)

## In-chat Image Generation ##

We need to incorporate in-chat image generation for agents. These images will be stored in the artifact system of the media library. We need to include the editing feature, where the agent uses the edit feature from OpenAI GPT-Image-1 and maybe even other image editing APis if available. The image generation tool needs to be enabled/disabled via the settings modal > tools tab. Not every agent needs to be able to generate images.

We want to add an image generation MCP tool for the agent to use. For now, because we are using responses API, we will we use OpenAI's GPT-image-1 models. The user should be able to turn on/off image generation capabilities in the Settings modal > Tools tab.

https://platform.openai.com/docs/guides/image-generation?image-generation-model=gpt-image-1

## AI generated Dashboards ##

Graphs, Charts, Tables, etc

We need to create a system of predefined UI elements and enable reports via Canvas. The user needs to be able to save these reports as custom dashboards inside our system, so they can be reviewed, refreshed and reported on at any time. We can added a temporary viewing capability similar to our existing temporary chat links. This will allow agents to become more useful, because they will be able to send links to users with temporary viewing privileges. Or we can have them generate PDF reports and send those links. The reports would be part of the artifact system in the existing media library system.

## Projects ##

Create a project management system similar to Asana and Clickup that empowers users to assign  agents to complete tasks. This should be a hybrid system where users and agents can be assigned to tasks. The user should be in control of when the project starts, and when agents actually perform the tasks assigned to them. Agents should be aware of what projects they are assigned to and what tasks they are assigned to, even in the chat interface.This means we should implement the project mechanism as an MCP tool, so that the agent can discover it as a tool during chat and determine if it should use the Project MCP tools to find assigned projects, tasks, etc. The user can assign context to the task, including in-task text descriptions, or upload documents. They can also assign the results of other completed tasks from other agents, users or the same agent to the current task in case there are project dependencies. Sidebar link, page where users can see projects in a list or grid. Project details page, live editing. Slide-in panel from right side for task details like asana. file uploads for each task.

## Delegated Access ##

Create a system where one user can invite other users, whether existing or not, to view and use their agents. This should work similar to GoDaddy's delegated access. If a user invites another user, and the user does not exist, then our system will send the new person an email with an invite link to sign up for an account. Once they sign up for an account, they will have to accept delegated permissions based on what they have been given by the prime account holder. If they already have an account, then they will receive an invitation via email they can follow to login and accept. When they accept, the prime account holder's (inviter) agents will show up in their 'agents' tab. 

## Teams ##

We need to be able to add deledated access for other user accounts. Users can invite other people to manage their accounts, CRUD agents, teams, projects, billing. Accounts with delegated access can view the interfaces of the primary account holder by switching into an instance of that account data, this way one account can be given delegated access to many accounts. This should allow for users to become managers and start AI agent agencies, or for internal AI departments to manage the main companies accounts. These delegated access accounts can be granted full access or limited access with granular permissions. This way users can be assigned access to specific agents, specific teams, and specific projects with read/write (view/edit) capabilities.

## Workspaces ##

We will modify the 'Workspaces' feature to work for 'Teams.' Teams will have their own workspaces. We will call them "Team Rooms" instead of "Workspaces." These are essential chat rooms where agents and human team members can collaborate on tasks. Tagging people or agents with the @ symbols. 

## AI-Generated Forms ##

Create a tool that allows Agents to generate forms with custom fields, that can be sent out to external users via temporary links--limited by time or usage/access. These forms can be one-time use, or users can choose to save the forms and even edit them using AI. They would save those results in a table or tables in JSON or YAML so they can be universally generated and pulled in and retrieved and used for a universally-generated display to users.  

## AI-Generated Dashboards/Reports ##

Create an MCP system where agents can generate reports. These reports will have their own temporary pages that can be viewed and discarded, downloaded in PDF or saved as a view and updated upon request.

## Agentic Task Generation ##

Add a step in our conversational process where, after the agent reasons through the request with integrated and determines tool use, instead of just executing, it should first generate a mini-project plan. The mini-project plan can be one of a select few options, depending on the complexity of the context and the request:

1. respond directly w/ no additional processing
2. research and respond
3. research and qualify, design response, quality assure and deliver response
4. research, design, implement, quality assure, deliver

These mini project plan phases should each come with their own subset of tasks for the agent to generate, perform and check off it's own list. This will require some perceptable autonomy, requiring that each task is reviewed for completion and signed off by the agent after the LLM provides the task response.

This means we also need a classifier step where an LLM determines if the message is general conversational, requires fact-based evidence that might require web search processing or some tool use like searching an inbox. It should measure the sensitivity of the request, meaning what level of expertise should it require? This will determine if there needs to be a qualifying step and quality assurance. 

When the classifier step happens, the LLM should respond within our JSON architecture of course, but also with the response classification, whether it is to respond directly or enter into one of the other phases. Once the agent response process enters into the recommended recommended type, then we have the agent develop its mini-plan with stages and subtasks. Then it completes each subtask through each phase, and then delivers the response.

When these determinants are below the threshold we give them, they become iterative, so that the LLM responses may trigger further research, or trigger further consideration, which a cap on how many iterations can be used before responding. 

This should also be visible through the UI, with the user seeing the various stages the LLM is going through to provide their response. This feature should be enabled/disabled by an icon under the chat input on the agent chat page. Maybe a lightning bolt.

## Context Board ##

The agent should have a small space in memory that retains two paragraph summary of what just happened, what is currently happening, and what it predicts will happen next. This should be provided via the assistant message area of the LLM.

## Memory ##

Change 'Knowledge' to 'Memory.' We will work inside different types of memory: episodic, semantic, working memory. All memory types will be optional and adjustable within the users pop up modal. 

## Time Server ##

Add time server as a tool

## Document Creation ##

Add PDF creation, .docx, .txt, as tools for the agent

## Background chat summaries ##

A background agent that is keeping track of summarizing the conversation, documenting important facts and memories that will probably be useful later. Basically stores them in a short form memory, and saves them to a summary table that has one row for each chat like 'chat_id,' 'summary notes', and 'important facts' or something.

## Values ## 

A background agent that reviews the current conversation, context, chat summaries and important information and 'agent value system' and determines if there are any long term values this agent should posess that would help it achieve its goal or become a better version of itself. It then writes the value in one or sentences and saves it to the agent values table with the agent_id. We will then create an adapter, ensuring that the values are delivered to the agent via the system prompt.

## Deep Memory Search as a Tool ##

We will provide every chat respone with a predefined set of memory settings,  but if we need a deeper memory search, like expanding upon topics to find new nodes and edges, or to lower the similarity score on episodic memory to bring in more old memories, or to expand the temporal aspect of a memory to bring in memories closer to a timeline event, we can provide these tools to the agent wihin a 'Deep Memory Search' framework, where it determines if it needs to activate the Deep Memory Search state, and then determines which type of deep memory searches it wants to complete, and then calls those memory searches like MCP tools.

## Optional Chat Features ##

Let's review our system and map a methodology for toggling certain features on, like 'advanced reasoning' 'tools'. This would just like how claude and chatgpt do it in their chat area.

## New User Workflows ##

Let's create a workflow for new users or users who do not have an idea of what to do. Maybe we can create a support agent that helps them generate ideas for what types of agents they should create based on what they are trying to do. Are they trying to increase productivity in their business? Are they trying to accomplish a specific goal? etc.

Voice and Speech Capabilities:

We need to add voice and speech capabilities to the agents. Integrate OpenAI streaming API, OpenAI voice (if there is an API for this) as well as Elevenlabs voices. Add the API key information to the admin settings area, as we will use this sitewide. The API keys should be stored in the vault, encrypted the same as other API keys. Then, add the capability to enable voice chat to the agent page.

Add the ability to record voice and have it transcribed into text for the agent as well, independent of voice chat.

https://platform.openai.com/docs/guides/realtime





---

## Completed: ##

## Investigate mcp_tool_cache ## (Completed)

Let's make sure that, when we get a successful tool call, we are saving that in our mcp_tool_cache. We should check against what is currently in the database, and if it is the same, then no update, but if it is different, then save the schema. Also, there should only be one record per tool. Let's make sure that constraint is already there. Then, we need to make sure we are providing this tool cache to the agent during mcp calls, 'here are the required parameters that have worked for this tool call: [parameters] in the initial and every retry, along with the mcp server's feedback.

## Update 'Tools' inside agent Behavior Tab ## (Completed)

I want to create a button on the Agent Chat Page > Settings Moda > Behavior Tab > Tools that queries the MCP tools for an agent, and then uses an LLM responds to format them like the following:

You have the following set of MCP tools:

## Contact Management System ## (Completed)

search_contacts - searches our internal database for contact information.

## QuickBooks Online ## (Complete)

quickbooks_online_update_estimate - updates estimates in QuickBook Online

4. Public Accessibility - I would like to create an API interface where agents can be accessed by outside systems like an app using authentication, etc.

## Centaralized LLM Calls and Model Selection ## (Complete)

We need to  create a centralized LLM API request system so we are not statically writing the model into functions. Our chat functions throughout code should be flexible and based on classes, and the API calls we make should be centralized and based on which model is currently set for the model variable. 

This will allow us to add a model selection to the admin settings/setup area, without breaking the entire application.


1. A memory based system that reviews and analyzes chat history (maybe a certain number of previous chats for every new message), reviews the knowledge graph data associated, and comes up with value statements that help it towards its end goal. We should probably give each agent its primary imperative, so it has an end goal that it views every request through. We will create a 'values' area in the JSON chat structure,, and we will provide a 'priority of consideration' mechanism within the chat so it knows where to focus its attention.

2. We will give users an area where they can add rules just like Cursor, and they can manage memories just like in Cursor. 

## Contact List ## (complete)

Create a centralized contact list page and system that allows me to add contacts to the system. Name, Numbers (work, home, cell), email address, home address, work address, birthdate and notes. Then, on the agent chat page add 'Contacts' system so that we can add contacts or enable access to all contacts for that specific agent. Create a 'Contacts Lookup Tool' that we will make available via the MCP tool system our agents already have. Investigate, Research, Plan, Implement using the @plan_and_execute.mdc protocol.

## SMS via ClickSend or Twilio ## (completed)

Add SMS capabilities via MCP protocol for agents.

## Cleanup agent_oauth_permissions table calls ## (completed)

There is an old table 'agent_oauth_permissions' and another named 'user_oauth_connections' that were consolidated into to 'agent_integration_permissions.' Grep the entire codebase and create a checklist of all the places in the codebase these calls exists. Then, go through each instance and replace it with the correct table name with the correct schema. Make sure the systems work after. Use the @plan_and_execute.mdc protocol.


## Tasks ## (Completed)

Add 'Steps' to tasks, allowing users to add multi-step instructions for the agent to follow. Do this, then do this upon completion, etc. The tasks happen sequentially, and the user can choose to have the output of the previous step(s) included in the context of the next task or not.

## Soft Refresh Fix ## (Completed)

There is an issue with the site, where when I leave the page and come back for any reason, it soft refreshes. The problem is I lose data in the modals and other places if I need to tab away for any reason. This needs to be investigated and fixed.

## Human-Reasoning Markov CoT Processor ##

- Add automatic chain-of-thought processor with inductive/abductive/deductive styles
- Score message complexity; select style; run dynamic Markov chain (analyze→hypothesize→test/tool→observe→update→conclude)
- Integrate RAOR loop for tools without blocking tool usage
- Persist safe reasoning summaries in responses; show in Process modal
- Feature-flagged rollout with thresholds and budgets

## Zapier Integration ##

Integrate Zapier MCP so agents have access to a plethora of tools.

## Memory System ## (Completed)

Our agents should have a short term memory that tracks a maximum amount of chat messages set by the user (up to a maximum of 0-100). Then, each chat should have an optional area for episodic memory, which pulls from a vector database (in our case pinecone, but needs to be remain flexible for future options) and semantic understanding through a knowledge graph (in our case GetZep, but needs to remain flexible for future options).

These additional memory types should, whenever activated and assigned, be storing user messages properly, building on episodic and semantic memory which each iterative conversation, up to a maximum storage limit that is set by the user plan and managed by the platform admins through the administration pages.
