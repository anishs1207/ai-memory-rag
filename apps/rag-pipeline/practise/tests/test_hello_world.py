# for testing of python functions:
# https://realpython.com/python-unittest/
# https://docs.python.org/3/library/unittest.html

import unittest

# suite of all methods to test present inside a class here
class TestStringMethods(unittest.TestCase):
    def test_upper(self):
        self.assertEqual("foo".upper(),"FOO")
    
    def test_isupper(self):
        self.assertTrue('FOO'.isupper())
        self.assertFalse("Foo".isupper())
    
    def test_split(self):
        s = "hello world"
        self.assertEqual(s.split(), ["hello", "world"])
        with self.assertRaises(TypeError):
            s.split(2)


if __name__ == "__main__":
    unittest.main()