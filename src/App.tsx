import { useMemo, useState } from 'react';
import { Check, Copy, Download, Search } from 'lucide-react';

import patchCombined from '../patches/milestone1-dg2-0x56a1.patch?raw';
import patch01 from '../patches/01-build-py.patch?raw';
import patch02 from '../patches/02-xe-platform.patch?raw';
import patch03 from '../patches/03-intelxe-h.patch?raw';
import patch04 from '../patches/04-lrc-h.patch?raw';
import patch05 from '../patches/05-intelxe-cpp.patch?raw';
import patch06 from '../patches/06-xe-core.patch?raw';

interface PatchEntry {
  id: string;
  filename: string;
  targetPath: string;
  summary: string;
  content: string;
}

const PATCHES: PatchEntry[] = [
  {
    id: 'combined',
    filename: 'milestone1-dg2-0x56a1.patch',
    targetPath: 'kernel/IntelXe/* (all 6 files)',
    summary: 'Complete Milestone 1 git diff verified with git apply --check against upstream HEAD.',
    content: patchCombined,
  },
  {
    id: '01',
    filename: '01-build-py.patch',
    targetPath: 'kernel/IntelXe/build.py',
    summary: 'Adds --platform dg2, dg2_guc_70.bin (70.53.0) embedding with expected/actual SHA-256 diagnostics, empty HuC stub, and IntelXe-DG2 IOPCIMatch 0x56a18086.',
    content: patch01,
  },
  {
    id: '02',
    filename: '02-xe-platform.patch',
    targetPath: 'kernel/IntelXe/xe_platform.cpp',
    summary: 'Enables -intelxe_allow_dg2 boot-arg gate and marks Milestone 1 bring-up scope on dg2().',
    content: patch02,
  },
  {
    id: '03',
    filename: '03-intelxe-h.patch',
    targetPath: 'kernel/IntelXe/IntelXe.h',
    summary: 'Defines DG2 MMIO registers (GUC_TLB_INV_CR, XEHP_FLAT_CCS_BASE_ADDR, XEHP_LNCFCMOCS0, GT_PERF_STATUS, RP_STATE_CAP_SNB) and 56 KB LRC MiscGGTT layout.',
    content: patch03,
  },
  {
    id: '04',
    filename: '04-lrc-h.patch',
    targetPath: 'kernel/IntelXe/lrc.h',
    summary: 'Adds gen12_xcs_offsets, dg2_xcs_offsets, dg2_rcs_offsets, and lrcRegOffsets() matching upstream xe_lrc.c reg_offsets().',
    content: patch04,
  },
  {
    id: '05',
    filename: '05-intelxe-cpp.patch',
    targetPath: 'kernel/IntelXe/IntelXe.cpp',
    summary: 'Adapts probe, forcewake ack, PAT/LNCF MOCS, GGTT PAT & TLB invalidation, GuC 70.53.0 load, ADS/WA gating, and BCS0 LRC offsets.',
    content: patch05,
  },
  {
    id: '06',
    filename: '06-xe-core.patch',
    targetPath: 'kernel/IntelXe/xe_core.cpp',
    summary: 'Updates SLPC params, XEHP flat CCS calculation, dual BAR2 sizing path (bar2 == nullptr tolerance), and queueCreate() LRC selector.',
    content: patch06,
  },
];

interface ArchRow {
  subsystem: string;
  bmg: string;
  dg2: string;
  upstreamRef: string;
}

const ARCH_DIFF: ArchRow[] = [
  {
    subsystem: 'IP Discovery',
    bmg: 'GMD_ID (0xd8c) -> 20.01 / 13.01',
    dg2: 'Pre-GMD_ID static descriptors (12.55 / 12.55)',
    upstreamRef: 'xe_pci.c / xe_platform.cpp',
  },
  {
    subsystem: 'GT Topology',
    bmg: 'Primary GT + standalone Media GT (+0x380000)',
    dg2: 'Single GT (maxGtPerTile = 1; media GT skipped)',
    upstreamRef: 'xe_gt.c',
  },
  {
    subsystem: 'Forcewake GT Ack',
    bmg: 'FORCEWAKE_ACK_GT_MTL (0xdfc)',
    dg2: 'FORCEWAKE_ACK_GT (0x130044)',
    upstreamRef: 'xe_force_wake.c',
  },
  {
    subsystem: 'PAT & MOCS',
    bmg: '32 PAT entries (0x4800..), GLOBAL_MOCS (0x4000..)',
    dg2: '4 xelp PAT entries [3,1,2,0], 64 XEHP_LNCFCMOCS0 (0xb020..)',
    upstreamRef: 'xe_pat.c / xe_mocs.c',
  },
  {
    subsystem: 'GGTT PTE & TLB Inv',
    bmg: 'PAT bits 52/53, PVC_GUC_TLB_INV_DESC0/1',
    dg2: 'PAT index 0 (bits 52/53 = 0), GUC_TLB_INV_CR (0xcee8)',
    upstreamRef: 'xe_ggtt.c',
  },
  {
    subsystem: 'Flat CCS Range',
    bmg: '0x8800/0x8804 + L3 node count',
    dg2: 'XEHP_FLAT_CCS_BASE_ADDR (0x4910, bits 31:8 * 64 KB)',
    upstreamRef: 'xe_vram.c',
  },
  {
    subsystem: 'Frequency Caps & CAGF',
    bmg: 'MTL_RP_STATE_CAP (0x138000), WP1 (0xc60)',
    dg2: 'RP_STATE_CAP_SNB (0x145998), FREQ_INFO_REC (0x145ef0), GT_PERF_STATUS (0x1381b4)',
    upstreamRef: 'xe_guc_pc.c',
  },
  {
    subsystem: 'GuC / HuC Firmware',
    bmg: 'bmg_guc_70.bin + bmg_huc.bin (GSC)',
    dg2: 'i915/dg2_guc_70.bin (70.53.0) only; HuC deferred',
    upstreamRef: 'xe_uc_fw.c',
  },
  {
    subsystem: 'LRC Sizes & Offsets',
    bmg: 'RCS 16 KB, CCS 12 KB, BCS 8 KB (xe2_*_offsets)',
    dg2: 'RCS 56 KB, CCS 56 KB, BCS 8 KB (dg2_rcs/xcs, gen12_xcs)',
    upstreamRef: 'xe_lrc.c',
  },
];

const COMMAND_GROUPS = {
  build: `# 1. Apply Milestone 1 patchset on clean upstream checkout
git apply --check patches/milestone1-dg2-0x56a1.patch
git apply patches/milestone1-dg2-0x56a1.patch

# 2. Fetch i915/dg2_guc_70.bin (70.53.0)
./firmware/fetch.sh --probe dg2

# 3. Build debug IntelXE.kext only (IntelXEFB left untouched)
python3 kernel/IntelXe/build.py --debug --only IntelXe --platform dg2`,
  ssh: `# Attach & platform check
ioreg -rn IntelXe -w0
ioreg -l -w0 | grep -E "IntelXe|IntelXePlatform|IntelXeReady|device-id|nmxgpu"

# Kernel boot / GuC / SLPC logs
sudo dmesg | grep -iE "IntelXe|GuC|SLPC|BAR2|56a1|dg2"
log show --last 10m --predicate 'eventMessage CONTAINS "IntelXe"'

# Interactive debug.intelxe steps (requires --debug build)
sysctl debug.intelxe
sudo sysctl -w debug.intelxe.step=1   # probe()
sudo sysctl -w debug.intelxe.step=6   # readGt() PAT + LNCFCMOCS
sudo sysctl -w debug.intelxe.step=10  # GT frequency caps
sudo sysctl -w debug.intelxe.step=20  # Full GuC 70.53.0 + BCS0`,
};

function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/x-patch;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-700" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
      <span>{copied ? 'Copied' : label}</span>
    </button>
  );
}

export default function App() {
  const [selectedPatchId, setSelectedPatchId] = useState<string>('01');
  const [diffFilter, setDiffFilter] = useState('');
  const [bar2Mode, setBar2Mode] = useState<'resized' | 'full'>('resized');

  const activePatch = useMemo(
    () => PATCHES.find((p) => p.id === selectedPatchId) ?? PATCHES[0],
    [selectedPatchId],
  );

  const filteredLines = useMemo(() => {
    const lines = activePatch.content.split('\n');
    const query = diffFilter.trim().toLowerCase();
    if (!query) return lines.map((line, index) => ({ line, num: index + 1 }));
    return lines
      .map((line, index) => ({ line, num: index + 1 }))
      .filter((entry) => entry.line.toLowerCase().includes(query));
  }, [activePatch, diffFilter]);

  const diffStats = useMemo(() => {
    let added = 0;
    let removed = 0;
    for (const line of activePatch.content.split('\n')) {
      if (line.startsWith('+') && !line.startsWith('+++')) added++;
      if (line.startsWith('-') && !line.startsWith('---')) removed++;
    }
    return { added, removed };
  }, [activePatch]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-4">
          <a href="#top" className="text-base font-semibold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            IntelXE DG2 Workbench
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#arch-diff" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Hardware Diff
            </a>
            <a href="#opencore" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              OpenCore &amp; BAR2
            </a>
            <a href="#patches" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              Patchset
            </a>
            <a href="#verify" className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0">
              SSH Verify
            </a>
          </nav>

          <button
            type="button"
            onClick={() => downloadFile('milestone1-dg2-0x56a1.patch', patchCombined)}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download Patch</span>
          </button>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-6xl space-y-12 px-6 py-10">
        <section className="space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-500">
              Milestone 1 · Arc A750 (0x8086:0x56A1) · GuC 70.53.0 · macOS Tahoe
            </p>
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl [text-wrap:balance]">
              Core Bring-Up Patchset for Alchemist DG2 on IntelXE.kext
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
              Verified unified diffs against upstream <span className="font-mono text-slate-800">yusufklncc/intel-gpu-macos-driver</span> for PCI
              probe, forcewake, PAT/LNCF MOCS, GGTT, GuC-only initialization, and dual-path BAR2 handling on Ryzen 3600 + OpenCore. Display
              output (<span className="font-mono text-slate-800">IntelXEFB.kext</span>) and user-space Metal/Vulkan remain intentionally untouched.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Target PCI ID</div>
              <div className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums">0x56A1</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">GuC Firmware</div>
              <div className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums">70.53.0</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">Modified Files</div>
              <div className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums">6</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs text-slate-500">DG2 RCS / CCS LRC</div>
              <div className="mt-1 font-mono text-lg font-semibold text-slate-900 tabular-nums">56 KB</div>
            </div>
          </div>
        </section>

        <section id="arch-diff" className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              01. Architectural Diff: Battlemage (BMG) vs. Alchemist (DG2)
            </h2>
            <span className="text-xs text-slate-500">Cross-referenced against Linux drivers/gpu/drm/xe</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600">
                  <th className="px-4 py-3">Subsystem</th>
                  <th className="px-4 py-3">Battlemage (Xe2 / 0xE20B)</th>
                  <th className="px-4 py-3">Alchemist (DG2 / 0x56A1)</th>
                  <th className="px-4 py-3">Linux Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {ARCH_DIFF.map((row) => (
                  <tr key={row.subsystem} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 font-medium text-slate-900 whitespace-nowrap">{row.subsystem}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{row.bmg}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-900">{row.dg2}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-500 whitespace-nowrap">{row.upstreamRef}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="opencore" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              02. OpenCore BAR2 Sizing &amp; Boot Arguments
            </h2>
            <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setBar2Mode('resized')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  bar2Mode === 'resized' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ResizeAppleGpuBars = 0 / 10
              </button>
              <button
                type="button"
                onClick={() => setBar2Mode('full')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  bar2Mode === 'full' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ResizeAppleGpuBars = -1
              </button>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  {bar2Mode === 'resized' ? 'Path A: Resized BAR2 (256 MB or 1 GB)' : 'Path B: Unresized 8 GB BAR2'}
                </h3>
                <span className="font-mono text-xs text-slate-500">
                  {bar2Mode === 'resized' ? 'Recommended' : 'Fallback'}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                {bar2Mode === 'resized'
                  ? 'Setting ResizeAppleGpuBars to 0 (256 MB) or 10 (1 GB) shrinks BAR2 before ExitBootServices so macOS IOPCIFamily maps bar2 cleanly. Both buddy allocators (gVis, gHi) initialize while LRCs stay safely in system RAM (gLrcVram = 0).'
                  : 'With ResizeAppleGpuBars = -1, IOPCIFamily typically fails to map an 8 GB BAR2 (bar2 == nullptr). xe_core.cpp allows bar2 == nullptr on < 20.00 platforms instead of returning ENXIO, skipping BAR2 VRAM tests while still verifying BAR0, forcewake, GGTT, GuC 70.53.0, and SLPC.'}
              </p>
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-800">
                Booter &rarr; Quirks &rarr; ResizeAppleGpuBars = {bar2Mode === 'resized' ? '0 (256 MB) or 10 (1 GB)' : '-1 (disabled)'}
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900">Required NVRAM boot-args</h3>
                <CopyButton text="-v debug=0x144 keepsyms=1 -intelxe_allow_dg2 -intelxe_nofb -intelxe_noaccel -intelxe_nometal" />
              </div>
              <pre className="overflow-x-auto rounded-md border border-slate-200 bg-slate-950 p-3 font-mono text-xs text-slate-100">
                -v debug=0x144 keepsyms=1 -intelxe_allow_dg2 -intelxe_nofb -intelxe_noaccel -intelxe_nometal
              </pre>
              <p className="text-xs leading-relaxed text-slate-500">
                Keep <span className="font-mono text-slate-700">IntelXEFB.kext</span> disabled in OpenCore <span className="font-mono text-slate-700">Kernel &rarr; Add</span> during Milestone 1 so <span className="font-mono text-slate-700">bootGuardHandOff()</span> leaves display on Apple&apos;s <span className="font-mono text-slate-700">IONDRVFramebuffer</span>.
              </p>
            </div>
          </div>
        </section>

        <section id="patches" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              03. Milestone 1 Patch Inspector
            </h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={diffFilter}
                  onChange={(e) => setDiffFilter(e.target.value)}
                  placeholder="Filter diff lines..."
                  className="w-52 rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none"
                />
              </div>
              <CopyButton text={activePatch.content} label="Copy Patch" />
              <button
                type="button"
                onClick={() => downloadFile(activePatch.filename, activePatch.content)}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span>Save .patch</span>
              </button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="space-y-1.5 lg:col-span-4">
              {PATCHES.map((patch) => {
                const selected = patch.id === activePatch.id;
                return (
                  <button
                    key={patch.id}
                    type="button"
                    onClick={() => setSelectedPatchId(patch.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selected
                        ? 'border-slate-900 bg-white text-slate-900'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                    }`}
                  >
                    <div className="font-mono text-xs font-semibold text-slate-900 truncate">{patch.filename}</div>
                    <div className="mt-0.5 font-mono text-[11px] text-slate-500 truncate">{patch.targetPath}</div>
                    <p className="mt-1.5 text-xs leading-snug text-slate-600">{patch.summary}</p>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-slate-950 lg:col-span-8">
              <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2.5 text-xs text-slate-300">
                <span className="font-mono">{activePatch.filename}</span>
                <span className="font-mono tabular-nums text-slate-400">
                  +{diffStats.added} / -{diffStats.removed} lines
                </span>
              </div>
              <div className="max-h-[540px] overflow-auto p-3 font-mono text-xs leading-5">
                {filteredLines.length === 0 ? (
                  <div className="py-8 text-center text-slate-400">No diff lines match &ldquo;{diffFilter}&rdquo;.</div>
                ) : (
                  filteredLines.map((entry) => {
                    let cls = 'text-slate-300';
                    if (entry.line.startsWith('+') && !entry.line.startsWith('+++')) cls = 'bg-emerald-950/50 text-emerald-300';
                    else if (entry.line.startsWith('-') && !entry.line.startsWith('---')) cls = 'bg-rose-950/50 text-rose-300';
                    else if (entry.line.startsWith('@@')) cls = 'text-sky-300';
                    else if (entry.line.startsWith('diff ') || entry.line.startsWith('index ')) cls = 'text-slate-400';

                    return (
                      <div key={entry.num} className={`flex gap-3 px-2 ${cls}`}>
                        <span className="w-9 shrink-0 select-none text-right text-slate-600 tabular-nums">
                          {entry.num}
                        </span>
                        <span className="whitespace-pre">{entry.line || ' '}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>

        <section id="verify" className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">
            04. Build &amp; First-Boot SSH Verification
          </h2>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">macOS Build Commands</h3>
                <CopyButton text={COMMAND_GROUPS.build} />
              </div>
              <pre className="overflow-x-auto rounded-md border border-slate-200 bg-slate-950 p-3.5 font-mono text-xs leading-5 text-slate-100">
                {COMMAND_GROUPS.build}
              </pre>
            </div>

            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-900">SSH Diagnostics &amp; Debug Steps</h3>
                <CopyButton text={COMMAND_GROUPS.ssh} />
              </div>
              <pre className="overflow-x-auto rounded-md border border-slate-200 bg-slate-950 p-3.5 font-mono text-xs leading-5 text-slate-100">
                {COMMAND_GROUPS.ssh}
              </pre>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
