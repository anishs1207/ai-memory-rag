import argparse # for cli tooling and parsing it
import logging # for logging
from module.tools.inside import me
import asyncio
import json
import os
import random

# style guide for python code
# https://google.github.io/styleguide/pyguide.html
# argparse:  https://docs.python.org/3/library/argparse.html
# handling and validtion for it (to handle other cases here)
# try-expect-finally block here
# logging lib for python here: https://docs.python.org/3/library/logging.html
# check out various loggint options to log into a differnt file
# impprt and __init__.py usage here
# error handling; https://docs.python.org/3/tutorial/errors.html
# https://www.geeksforgeeks.org/python/what-is-__init__-py-file-in-python/
# init was reqd before now python uses namespace etc
# asyncio package: https://docs.python.org/3/library/asyncio.html
# since python runs code seqeuntials (and so run code concurrenltly withoyt blocking we use)
# gives async and await which cane be used here
# can use await asyncio.sleep() or any function which marked as async can be awaited here
# json (used to encode, decode into json foramt for sending across internte)
# https://docs.python.org/3/library/json.html
# os packag: used for interacting with the native filesystem, os
# https://docs.python.org/3/library/os.html
# random number generation: https://docs.python.org/3/library/random.html
# re library: used for regular expressions (regex): https://docs.python.org/3/library/re.html
# time => for all time related stuff
# typing => https://docs.python.org/3/library/typing.html
# typing library provides static type annotations, but it does not itself enforce static typing at runtime.
# so just for dev help (does not actually enforce that static typing used here)
# claude_agent_sdk doc: https://code.claude.com/docs/en/agent-sdk/overview
# sys => for system specific parameters
# https://docs.python.org/3/library/sys.html
# pathlib => for path related stuff & dotenv (load_dotenv) for env variables (loading process)
# https://pypi.org/project/python-dotenv/
# create a centralised file (/config/setting.py) which imports all of env varobales and other constants (nomm snetive here)
# similar to constants.ts inside a nodejs-express backend
# s

class HelloWorld:
    def __init__(self):
        self.name = name
        self.age = age
        self.marks = marks
    
    def print_name(self):
        print(self.name)

    def print_age(self):
        print(self.age)

# cpu insteblcu task so tgat it can take place oncurenley
async def async_code():
    print("hello")

    await asyncio.sleep(2)  

    print("world")

# to eastlish tge logging here
logger = logging.getLogger(__name__)

# full fledges cli tooling
def main():
    # to confire logger and store here in .log fiek witg diffent modes of logging (info, warn etc)
    logging.basicConfig(filename="myapp.log", level=logging.INFO)

    logger.info("started")

    logger.info("finished here")

    asyncio.run(async_code())   

    parser = argparse.ArgumentParser(
        description="Anish's bidding agent"
    )

    parser.add_argument(
        "--options",
        choices=["hello"],
        default="hello",
        help="Hello World"
    )

    parser.add_argument(
        "--say",
        action="store_true",
        help="say Hello"
    )

    is_grad = True

    if is_grad:
        print("you are graduate")
    else:
        print("you are not  agraudte here")

    # cli tooling to be added here

    parser.add_argument(
        "--world",
        action="store_true",
        help="Hello WOrld"
    )

    me.helloworld()
    me.hello()
    me.world()

    input_object = ["foo", {
        "bar": ("baz", None, 1.0, 2)
    }]

    print("planning to encode", input_object)
    

    encoded = json.dumps(input_object)
    # converts to json format

    print(json.loads(encoded))

    try:
        print(8/0)
    except Exception as ep:
        print("hello", ep)
    finally:
        print("world fianlky jere")


if __name__ == "__main__":
    main()