#!/usr/bin/env python3
"""Wrapper to export gaussian splat with torch.load monkey-patched for PyTorch 2.6+."""
import sys
import torch

# Monkey-patch torch.load to force weights_only=False
_original_load = torch.load
def _patched_load(*args, **kwargs):
    kwargs["weights_only"] = False
    return _original_load(*args, **kwargs)
torch.load = _patched_load

from nerfstudio.scripts.exporter import Commands
import tyro
tyro.cli(Commands).main()
