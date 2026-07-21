import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions
from typing import Any
# ref of all tools avaibale in claude code
# https://code.claude.com/docs/en/tools-reference
# query: for eash new api call with claude models
# diff between claude code & claude agent sdk:
# Claude Code = an application you use.
# Claude Agent SDK = a library you build with.
# but they ue same underlying agent engine to work
# how to create new tool (custom apart from the one which are provided)
# Yes. int, str, float, bool, list, dict, tuple, set, and type are all built-in Python types, so you don't import them.
# for complex ones need to use the tyoing package here
# decorators are used to define the stecture of the tool (name, descp, praram it takes etc)
# and the actual function of its wokring is defined below it
# for running the agent, CAN ONLY expose tools via MCP SERVER function not manully like in other frameowkrs like langchain
# create_sdk_mcp_server()
# fixed type to return the result of the tool also: {"content": [{"type": "text", "text": f"Sum: {args['a'] + args['b']}"}]}

async def main():
    async for message in query(
        prompt="FInd and fix yhe bug in the auth.py file",
        options=ClaudeAgentOptions(allowed_tools=["Read", "Edit", "Bash"]),
        permission_mode="acceptEdits",
        cwd="/home/user/project"
    ):
        print(message)
        # stramed messafes here

# for creating a new mcp tool
# functions need to be anooated to ensure type safe coding
def do_something():
    return {"content": [{"type": "text", "text": f"Hello, {args['name']}!"}]}


@tool("greet", "Greets a user", {"name": str})
async def greet(args: dict[str, Any]) -> dict[str, Any]:
    result = do_something()
    return result

asyncio.run(main())


# decorated which are used to define the tools to be used hee

@tool("search", "Searchs the web", {"query": str}, annoations=ToolsAnnotations(readOnlyHint=True, openWorldHint=True))
async def search(args: dict[str, Any]) -> dict[str, Any]:
    # takes a json payload and returns a json payload
    return {"content": "anish"}

# tools for calculators defined here
@tool("add". "Add 2 numbers", {"a": float, "b":float})
async def add(args):
    return  {"content": [{"type": "text", "text": f"Sum: {args['a'] + args['b']}"}]}

@tool("multiply", "Multiply 2 numbers", {"a": float, "b": float})
async def multiply(args):
    return {"content": [{"type": "text", "text": f"Product: {args['a'] * args['b']}"}]}

calculator = create_sdk_mcp_server(
    name"calculator",
    version="2.0.0",
    tools=[add, multiply]
)

options = ClaudeAgentOptions(
    mcp_server={"calc": calculator},
    allowed_tools=["mcp__calc_add"]
)

# gmail tooling
# base64 lib => used for convertion in base64 encoding-decoidng etc
# google libs to connect with gmail (search)
# refer: https://developers.google.com/workspace/gmail/api/quickstart/python
# bs4 (beautiugl soup) => used for parsing xml and html pages into text
# https://tedboy.github.io/bs4_doc/
# seperate log files for seperate services running (like diff logger for uship_agent.gmail) to record its logs
# now it exposes the gmail tools in the form of a class (to keep track of credentiiasl and functions realted to all funcilities need)
# for it refer to google docs on connevibtley
# instead of spertae store for crentials and funtions (bundled tigether the data members and members for it)
# requests: simple http lib for making http requests: https://pypi.org/project/requests/
# tools (gmail tool with gmail apis, pricing tools with pricing apis SD API, alerts tool for drafting  alert email and send via gmail client, also send emails if faliture occurs for sending a particular kind of email)
# heartbeat helper => writes small JSOn file at start and end of eacg style, so externla watchdog can see if alive and making prohtess or detect if crashed
# other tools (deduplication tool to track procssed shipment to aovid duplicate bids being made)
# @classmethod decorator used inside classes used to craete function which are static (belong to the class itself)
# stil check @staticmethod and that difference


# how does browser automation work in ushiop
# shutil package: provides a noof high level operations on files and collections of files
# https://docs.python.org/3/library/shutil.html
# subprocess: used to spwam new processes (not threads)