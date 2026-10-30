# Start here

<!-- The banner at the top of the intranet's home page (apps/dashboard, npm run intranet).
     The first heading is its title, the paragraph under it its opening line, and each `##` section
     a column. Edit it like any other file: the next build shows it. Keep it short enough to read
     in a minute; a viewer who closes it can open it again from its title. -->

This is the organization's private intranet. Every page is built from the repository, so when
something here is wrong, the file behind it is what needs fixing.

## Quickstart

1. To open a session, open the organization's folder in Claude Code, in the Code tab, or type
   `claude` in that folder.
2. Say where you want to start: "where do we stand?", "start tracking the brochure", "draft the
   reply to the printer".
3. Drop a file in `source/inbox/` and say what it is. The agent files it and empties the folder.
4. When the agent gets something wrong, say so. It writes the correction into a guide.
5. Say "check my setup" when something behaves oddly on one computer.

## Where things live

- `source/` holds the facts with their sources, the decisions with their reasons, and the brand.
- `projects/` has a folder per piece of work: its charter, its log and its next steps.
- `STACK.md` lists what runs on what, and how to leave each service.
- This intranet, the website, the decks and the documents are all built from those files.

## How this works

The repository is the one source of truth. Everything else, this page included, is a view of it
that can be rebuilt at any time.

Mail, Drive, Notion and chat are where material arrives. The agent reads them and records what
matters in the repository; nothing is written back to them as the record.

A task that comes back becomes a workflow: a skill, a script or a page here, so the second time
costs less than the first.

Every correction becomes a rule the next session reads, so you only have to make it once.
