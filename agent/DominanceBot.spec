# DominanceBot.spec -- PyInstaller build spec
# Run: pyinstaller DominanceBot.spec --noconfirm

from pathlib import Path
from PyInstaller.utils.hooks import collect_all

block_cipher = None

# Collect rlbot package data
rlbot_datas, rlbot_binaries, rlbot_hiddenimports = collect_all('rlbot')
flat_datas, flat_binaries, flat_hiddenimports = collect_all('rlbot_flatbuffers')

a = Analysis(
    ['agent.py'],
    pathex=[],
    binaries=rlbot_binaries + flat_binaries,
    datas=rlbot_datas + flat_datas,
    hiddenimports=[
        'rlbot',
        'rlbot.managers',
        'rlbot.managers.match',
        'rlbot.interface',
        'rlbot.gateway',
        'rlbot_flatbuffers',
        'flatbuffers',
    ] + rlbot_hiddenimports + flat_hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'numpy', 'PIL', 'scipy'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='DominanceBot',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=True,
    icon='assets/icon.ico',
    version='version_info.py',
)
