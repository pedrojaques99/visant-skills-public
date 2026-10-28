#!/usr/bin/env python3
# Old name kept for muscle memory: runs plan.py.
import os, runpy
runpy.run_path(os.path.join(os.path.dirname(os.path.abspath(__file__)), "plan.py"), run_name="__main__")
