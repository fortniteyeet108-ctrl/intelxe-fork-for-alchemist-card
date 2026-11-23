# Milestone 1: Intel Arc A750 (DG2 / 0x56A1) Core Bring-Up Patchset

Target upstream repository: `yusufklncc/intel-gpu-macos-driver` (`main` @ `990b650315b1727f825ab37186be9d1142c97bf7`)
Target GPU: **Intel Arc A750** (`0x8086:0x56A1`, DG2-G10 / Alchemist, Xe-HPG `12.55`, pre-GMD_ID)
Target Host: AMD Ryzen 5 3600 (OpenCore + AMD Vanilla patches, no iGPU), **macOS 15 Sequoia (Darwin 24.x)**

## Scope (Strict Milestone 1)
- **Modified**: `IntelXE.kext` only (`kernel/IntelXe/{build.py,xe_platform.cpp,IntelXe.h,lrc.h,IntelXe.cpp,xe_core.cpp}`).
- **Untouched**: `IntelXEFB.kext` (display/framebuffer), `NMXAccel` / Metal / Mesa ANV user-space drivers.
- **Firmware**: GuC-only (`i915/dg2_guc_70.bin`, version `70.53.0`, SHA-256 `e6e3f8b4480ba976c89c491ac736d6ce41fa82e0cf5726d0763142da3fe8a63b`). HuC/GSC deferred (`kHucFwSize == 0`, `dg2().hucFw = nullptr`).

---

## 1. Apply the Patchset & Fetch Firmware

```bash
git clone https://github.com/yusufklncc/intel-gpu-macos-driver.git
cd intel-gpu-macos-driver

# Apply combined Milestone 1 patch (or apply 01..06 sequentially)
git apply --check /path/to/patches/milestone1-dg2-0x56a1.patch
git apply /path/to/patches/milestone1-dg2-0x56a1.patch

# Download i915/dg2_guc_70.bin (70.53.0) into firmware/
./firmware/fetch.sh --probe dg2
```

---

## 2. Build `IntelXE.kext` (CLI or Xcode External Build System)

This repository builds `IntelXE.kext` using `kernel/IntelXe/build.py` against `MacKernelSDK` (no standalone `.xcodeproj` target is shipped). Both `IntelXe.kext` and `IntelXeFB.kext` are linked with `-mmacosx-version-min=10.6` and `-no_fixup_chains`, making the compiled binaries directly compatible with macOS 15 Sequoia (`Darwin 24.x`).

### Direct macOS Build
```bash
python3 kernel/IntelXe/build.py --debug --only IntelXe --platform dg2
```
- Output bundle: `build/IntelXE.kext` (with `IntelXe-DG2` personality matching `IOPCIMatch = 0x56a18086`).
- `--debug` enables `debug.intelxe.*` sysctl handlers for interactive SSH bring-up verification (`step=1`, `6`, `10`, `20`, etc.).

### Xcode External Build System Setup
If building from Xcode:
1. Create an **External Build System** target in Xcode (`File -> New -> Target -> Cross-platform -> External Build System`).
2. Set **Build Tool** to `/usr/bin/python3`.
3. Set **Arguments** to `kernel/IntelXe/build.py --debug --only IntelXe --platform dg2`.
4. Set **Directory** to your `intel-gpu-macos-driver` clone root.

---

## 3. OpenCore `config.plist` Configuration

### A. Required `boot-args`
```text
-v debug=0x144 keepsyms=1 -intelxe_allow_dg2 -intelxe_nofb -intelxe_noaccel -intelxe_nometal
```
- `-intelxe_allow_dg2`: Opts into untested DG2/Alchemist probe (`d.testerBootArg = "intelxe_allow_dg2"`).
- `-intelxe_nofb -intelxe_noaccel -intelxe_nometal`: `IntelXe::bootGuardDecide()` explicitly forces `kDisplayFirmware` whenever `-intelxe_nofb` (or `-intelxefb_off`) is present, keeping display handoff on Apple `IONDRVFramebuffer` (`bootGuardHandOff()` sets `nmxgpu-claimed = false`) so you keep console/SSH access while testing `IntelXE.kext` alone. *(On macOS 15 Sequoia `Darwin < 25`, omitting `-intelxe_nofb` lets unaccelerated `IntelXeFB` draw WindowServer cleanly in Milestone 2.)*

### B. `ResizeAppleGpuBars` Paths (`Booter -> Quirks -> ResizeAppleGpuBars`)
With Resizable BAR enabled in BIOS on Ryzen 3600 + Arc A750 (8 GB BAR2):

- **Path A — Recommended (`ResizeAppleGpuBars = 0` or `10`)**:
  OpenCore shrinks BAR2 down to 256 MB (`0`) or 1 GB (`10`) before ExitBootServices so macOS `IOPCIFamily` maps `bar2` cleanly (`pci->mapDeviceMemoryWithRegister(0x18, kIOMapWriteCombineCache)` succeeds). Full VRAM buddy allocator (`gVis`/`gHi`) initializes, while LRCs remain safely in system memory (`gLrcVram = 0`).
- **Path B — Unresized 8 GB BAR (`ResizeAppleGpuBars = -1`)**:
  `IOPCIFamily` typically fails to map an 8 GB BAR2 (`bar2 == nullptr`). `xe_core.cpp` tolerates `bar2 == nullptr` on `< 20.00` platforms instead of aborting with `ENXIO`, skips BAR2-dependent allocators (`buddyInit`, `scratchInit`, `recordGolden`, `vramClearInit`), keeps `gLrcVram = 0`, and still completes BAR0 MMIO, forcewake, GGTT, PAT/MOCS, GuC 70.53.0 load, CTB handshake, and SLPC initialization.

*(Check `nvram` / `config.plist` does NOT block `IntelXE.kext` via `Kernel -> Block`, and place `IntelXE.kext` in `Kernel -> Add` with `IntelXEFB.kext` disabled during Milestone 1.)*

---

## 4. First-Boot SSH Verification Commands

After booting into macOS 15 Sequoia and connecting over SSH:

```bash
# 1. Confirm IntelXe attached to 0x56a1 and check platform/ready properties
ioreg -rn IntelXe -w0
ioreg -l -w0 | grep -E "IntelXe|IntelXePlatform|IntelXeReady|device-id|nmxgpu"

# 2. Check BAR0 / BAR2 resources assigned to the PCI device (GFX0 / display@0)
ioreg -p IODeviceTree -l -w0 | grep -A 30 -E "56a1|a156"

# 3. Inspect kernel logs for probe, forcewake, GGTT, PAT/MOCS, GuC 70.53.0 boot, SLPC
sudo dmesg | grep -iE "IntelXe|GuC|SLPC|BAR2|56a1|dg2"
log show --last 10m --predicate 'eventMessage CONTAINS "IntelXe"'

# 4. Inspect debug sysctls (when built with --debug)
sysctl debug.intelxe

# 5. Interactive bring-up steps over SSH (only when built with --debug)
sudo sysctl -w debug.intelxe.step=1   # probe() — GMD/pre-GMD ID, GU_CNTL, fuses, acks
sudo sysctl -w debug.intelxe.step=6   # readGt() — PAT (4 entries) & XEHP_LNCFCMOCS0
sudo sysctl -w debug.intelxe.step=10  # GT frequency caps (RP_STATE_CAP_SNB / FREQ_INFO_REC / GT_PERF_STATUS)
sudo sysctl -w debug.intelxe.step=20  # Full GuC 70.53.0 load + CTB + BCS0 sanity check
sudo dmesg | tail -n 80
```
