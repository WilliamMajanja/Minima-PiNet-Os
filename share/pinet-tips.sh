#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════════════
# Command Line Kung Fu — Tips Database
# Based on "Command Line Kung Fu" by Jason Cannon
# ═══════════════════════════════════════════════════════════════════════════════

TIPS_VERSION="1.0.0"

# ─── Shell History ──────────────────────────────────────────────────────────────

TIPS_SHELL_HISTORY_COUNT=11

TIPS_SHELL_HISTORY_1_TITLE="Run the Last Command as Root"
TIPS_SHELL_HISTORY_1_CMD="sudo !!"
TIPS_SHELL_HISTORY_1_DESC="Repeat the most recent command with root privileges using sudo !! or su -c \"!!\""

TIPS_SHELL_HISTORY_2_TITLE="Repeat Last Command Starting with String"
TIPS_SHELL_HISTORY_2_CMD="!<string>"
TIPS_SHELL_HISTORY_2_DESC="Recall the most recent command that begins with <string>. Example: !w repeats last command starting with 'w'"

TIPS_SHELL_HISTORY_3_TITLE="Reuse First Argument from Previous Command"
TIPS_SHELL_HISTORY_3_CMD="!^"
TIPS_SHELL_HISTORY_3_DESC="Grabs the second word (first argument) from the previous command line"

TIPS_SHELL_HISTORY_4_TITLE="Reuse Last Argument from Previous Command"
TIPS_SHELL_HISTORY_4_CMD="!$"
TIPS_SHELL_HISTORY_4_DESC="Access the last item from the previous command line. Example: unzip file.zip then rm !$"

TIPS_SHELL_HISTORY_5_TITLE="Reuse Nth Word from Previous Command"
TIPS_SHELL_HISTORY_5_CMD="!!:N"
TIPS_SHELL_HISTORY_5_DESC="Access word N from previous command. 0=command, 1=first arg, 2=second arg, etc."

TIPS_SHELL_HISTORY_6_TITLE="Repeat Command with String Substitution"
TIPS_SHELL_HISTORY_6_CMD="^string1^string2^"
TIPS_SHELL_HISTORY_6_DESC="Quickly correct typos. Replace string1 with string2 in previous command. Append :& to replace all occurrences"

TIPS_SHELL_HISTORY_7_TITLE="Reference Word of Current Command"
TIPS_SHELL_HISTORY_7_CMD="!#:N"
TIPS_SHELL_HISTORY_7_DESC="Reference a word on the current command line. Example: mv file.pdf Chapter-18-!#:1"

TIPS_SHELL_HISTORY_8_TITLE="Save Session Transcript"
TIPS_SHELL_HISTORY_8_CMD="script [filename]"
TIPS_SHELL_HISTORY_8_DESC="Capture everything printed on terminal to a file. Default filename is 'typescript'"

TIPS_SHELL_HISTORY_9_TITLE="Find Most Used Commands"
TIPS_SHELL_HISTORY_9_CMD="history | awk '{print \$2}' | sort | uniq -c | sort -rn | head"
TIPS_SHELL_HISTORY_9_DESC="Display top 10 most used commands in your shell history"

TIPS_SHELL_HISTORY_10_TITLE="Clear Shell History"
TIPS_SHELL_HISTORY_10_CMD="history -c"
TIPS_SHELL_HISTORY_10_DESC="Clear all shell history entries"

TIPS_SHELL_HISTORY_11_TITLE="Fix Common Typos with Aliases"
TIPS_SHELL_HISTORY_11_CMD="alias typo='correct spelling'"
TIPS_SHELL_HISTORY_11_DESC="Create aliases for frequently mistyped commands. Example: alias grpe='grep'"

# ─── Text Processing ────────────────────────────────────────────────────────────

TIPS_TEXT_PROCESSING_COUNT=10

TIPS_TEXT_PROCESSING_1_TITLE="Strip Comments and Blank Lines"
TIPS_TEXT_PROCESSING_1_CMD="grep -E -v '^#|^$' file"
TIPS_TEXT_PROCESSING_1_DESC="Remove comments and blank lines from config files using regex inversion"

TIPS_TEXT_PROCESSING_2_TITLE="Display Output in a Table"
TIPS_TEXT_PROCESSING_2_CMD="alias ct='column -t'"
TIPS_TEXT_PROCESSING_2_DESC="Format text into aligned columns. Use: command | ct"

TIPS_TEXT_PROCESSING_3_TITLE="Grab Last Word on a Line"
TIPS_TEXT_PROCESSING_3_CMD="awk '{print \$NF}' file"
TIPS_TEXT_PROCESSING_3_DESC="Print the last field/word from each line. Use -F to change field separator"

TIPS_TEXT_PROCESSING_4_TITLE="View Colorized Output with Less"
TIPS_TEXT_PROCESSING_4_CMD="ls --color=always | less -R"
TIPS_TEXT_PROCESSING_4_DESC="Force color output and display it properly in less pager"

TIPS_TEXT_PROCESSING_5_TITLE="Preserve Color When Piping to Grep"
TIPS_TEXT_PROCESSING_5_CMD="ls -l --color=always | grep --color=never string"
TIPS_TEXT_PROCESSING_5_DESC="Keep colorized input when piping to grep by disabling grep's color"

TIPS_TEXT_PROCESSING_6_TITLE="Append Text to File Using Sudo"
TIPS_TEXT_PROCESSING_6_CMD="echo text | sudo tee -a file"
TIPS_TEXT_PROCESSING_6_DESC="Append text to a file requiring root privileges. Works where sudo echo > file fails"

TIPS_TEXT_PROCESSING_7_TITLE="Change Case of a String"
TIPS_TEXT_PROCESSING_7_CMD="echo \$VAR | tr [:upper:] [:lower:]"
TIPS_TEXT_PROCESSING_7_DESC="Convert uppercase to lowercase (or vice versa) using tr command"

TIPS_TEXT_PROCESSING_8_TITLE="Display PATH in Readable Format"
TIPS_TEXT_PROCESSING_8_CMD="echo \$PATH | tr ':' '\n'"
TIPS_TEXT_PROCESSING_8_DESC="Convert colon-separated PATH to one entry per line for readability"

TIPS_TEXT_PROCESSING_9_TITLE="Display Text Block Between Two Strings"
TIPS_TEXT_PROCESSING_9_CMD="awk '/start-pattern/,/stop-pattern/' file.txt"
TIPS_TEXT_PROCESSING_9_DESC="Extract a block of text between start and stop patterns (strings or regex)"

TIPS_TEXT_PROCESSING_10_TITLE="Sort Output Leaving Header Intact"
TIPS_TEXT_PROCESSING_10_CMD="body() { IFS= read -r header; printf '%s\\n' \"\$header\"; \"\$@\"; }"
TIPS_TEXT_PROCESSING_10_DESC="Define body() function then use: command | body sort. Keeps header line unsorted"

# ─── Networking & SSH ───────────────────────────────────────────────────────────

TIPS_NETWORKING_COUNT=10

TIPS_NETWORKING_1_TITLE="Serve Files via Web Interface"
TIPS_NETWORKING_1_CMD="python3 -m http.server [port]"
TIPS_NETWORKING_1_DESC="Start a web server serving current directory. Default port 8000"

TIPS_NETWORKING_2_TITLE="Mount Remote Directory via SSH"
TIPS_NETWORKING_2_CMD="sshfs remote-host:/directory mountpoint"
TIPS_NETWORKING_2_DESC="Mount a remote directory locally via SSH. Unmount with: fusermount -u mountpoint"

TIPS_NETWORKING_3_TITLE="Get Public IP from Command Line"
TIPS_NETWORKING_3_CMD="curl ifconfig.me"
TIPS_NETWORKING_3_DESC="Display your public (Internet) IP address. Also try: curl ifconfig.me/ip"

TIPS_NETWORKING_4_TITLE="SSH Without Password"
TIPS_NETWORKING_4_CMD="ssh-keygen && ssh-copy-id remote-host"
TIPS_NETWORKING_4_DESC="Generate SSH key pair and copy public key to remote host for passwordless login"

TIPS_NETWORKING_5_TITLE="Show Open Network Connections"
TIPS_NETWORKING_5_CMD="sudo lsof -Pni"
TIPS_NETWORKING_5_DESC="Display open network connections. -P=no port names, -n=no host names, -i=network"

TIPS_NETWORKING_6_TITLE="Compare Remote and Local Files"
TIPS_NETWORKING_6_CMD="ssh remote-host cat /path/file | diff /path/localfile"
TIPS_NETWORKING_6_DESC="Cat a file over SSH and pipe to diff to compare with local version"

TIPS_NETWORKING_7_TITLE="Create SSH Tunnel"
TIPS_NETWORKING_7_CMD="ssh -N -L local-port:host:remote-port remote-host"
TIPS_NETWORKING_7_DESC="Forward local port through SSH to remote host. -N=no shell command"

TIPS_NETWORKING_8_TITLE="Find Programs Listening on Ports"
TIPS_NETWORKING_8_CMD="sudo netstat -nutlp"
TIPS_NETWORKING_8_DESC="Show listening programs with PID. -n=numeric, -u/-t=UDP/TCP, -l=listening, -p=PID"

TIPS_NETWORKING_9_TITLE="Run Command Immune to Hangups"
TIPS_NETWORKING_9_CMD="nohup command &"
TIPS_NETWORKING_9_DESC="Keep a command running after disconnect. Output goes to nohup.out by default"

TIPS_NETWORKING_10_TITLE="SSH SOCKS Proxy for Browsing"
TIPS_NETWORKING_10_CMD="ssh -D PORT remote-host"
TIPS_NETWORKING_10_DESC="Encrypt web browsing through SSH tunnel. Configure browser to use SOCKS5 proxy on localhost:PORT"

# ─── Shell Scripting ────────────────────────────────────────────────────────────

TIPS_SCRIPTING_COUNT=6

TIPS_SCRIPTING_1_TITLE="For Loop at Command Line"
TIPS_SCRIPTING_1_CMD="for VAR in LIST; do command \$VAR; done"
TIPS_SCRIPTING_1_DESC="Perform actions on a list of items. Example: for user in bob jill fred; do sudo passwd -l \$user; done"

TIPS_SCRIPTING_2_TITLE="Command Substitution"
TIPS_SCRIPTING_2_CMD="\$(command)"
TIPS_SCRIPTING_2_DESC="Capture command output for use as argument or variable. Modern form uses \$(command)"

TIPS_SCRIPTING_3_TITLE="Store Output as Variable"
TIPS_SCRIPTING_3_CMD="VAR=\$(command)"
TIPS_SCRIPTING_3_DESC="Assign command output to a variable for reuse later in the script"

TIPS_SCRIPTING_4_TITLE="Read Input Line by Line"
TIPS_SCRIPTING_4_CMD="while read LINE; do echo \$LINE; done < file.txt"
TIPS_SCRIPTING_4_DESC="Iterate over lines in a file. More robust than for loop for line-oriented data"

TIPS_SCRIPTING_5_TITLE="Accept User Input"
TIPS_SCRIPTING_5_CMD="read -p \"Prompt: \" VAR"
TIPS_SCRIPTING_5_DESC="Read user input with a prompt. Use -n 1 for single character input"

TIPS_SCRIPTING_6_TITLE="Sum Numbers in a Column"
TIPS_SCRIPTING_6_CMD="awk '{ sum += \$1 } END { print sum }' file"
TIPS_SCRIPTING_6_DESC="Add up all numbers in the first column of a file using awk"

# ─── System Administration ──────────────────────────────────────────────────────

TIPS_SYSTEM_ADMIN_COUNT=8

TIPS_SYSTEM_ADMIN_1_TITLE="Display Mounted Filesystems in Table"
TIPS_SYSTEM_ADMIN_1_CMD="mount | column -t"
TIPS_SYSTEM_ADMIN_1_DESC="Format mount output into aligned columns for readability"

TIPS_SYSTEM_ADMIN_2_TITLE="Kill All Processes for User/Program"
TIPS_SYSTEM_ADMIN_2_CMD="pkill -9 command"
TIPS_SYSTEM_ADMIN_2_DESC="Kill all processes matching command. Add -u user to filter by user"

TIPS_SYSTEM_ADMIN_3_TITLE="Repeat Command Until It Succeeds"
TIPS_SYSTEM_ADMIN_3_CMD="while true; do command && break; done"
TIPS_SYSTEM_ADMIN_3_DESC="Loop until command succeeds. Example: ping until host responds"

TIPS_SYSTEM_ADMIN_4_TITLE="Find Who Uses Most Disk Space"
TIPS_SYSTEM_ADMIN_4_CMD="sudo du -s /home/* | sort -n"
TIPS_SYSTEM_ADMIN_4_DESC="Show disk usage per home directory, sorted with largest at bottom"

TIPS_SYSTEM_ADMIN_5_TITLE="Find Largest Files"
TIPS_SYSTEM_ADMIN_5_CMD="find / -type f -exec wc -c {} \\; | sort -n"
TIPS_SYSTEM_ADMIN_5_DESC="Find files using most disk space. Smallest first, largest last"

TIPS_SYSTEM_ADMIN_6_TITLE="List Processes Sorted by Memory"
TIPS_SYSTEM_ADMIN_6_CMD="ps aux | sort -nk 4"
TIPS_SYSTEM_ADMIN_6_DESC="Show processes sorted by memory usage (column 4). Largest consumers at bottom"

TIPS_SYSTEM_ADMIN_7_TITLE="Check 32-bit or 64-bit System"
TIPS_SYSTEM_ADMIN_7_CMD="getconf LONG_BIT"
TIPS_SYSTEM_ADMIN_7_DESC="Quickly determine if system is 32-bit or 64-bit"

TIPS_SYSTEM_ADMIN_8_TITLE="Generate Random Password"
TIPS_SYSTEM_ADMIN_8_CMD="openssl rand -base64 48 | cut -c1-20"
TIPS_SYSTEM_ADMIN_8_DESC="Generate a random password. Change 20 to desired length"

# ─── Files & Directories ────────────────────────────────────────────────────────

TIPS_FILES_COUNT=9

TIPS_FILES_1_TITLE="Quick Backup of a File"
TIPS_FILES_1_CMD="cp file{,.bak}"
TIPS_FILES_1_DESC="Use brace expansion to create backup copy. Creates file.bak from file"

TIPS_FILES_2_TITLE="Change File Extension"
TIPS_FILES_2_CMD="mv file{.old,.new}"
TIPS_FILES_2_DESC="Rename file extension using brace expansion. Example: mv report.{txt,doc}"

TIPS_FILES_3_TITLE="Backup by Date"
TIPS_FILES_3_CMD="alias d='date +%F'"
TIPS_FILES_3_DESC="Create date alias then use: cp file.conf file.conf.\$(d) for dated backups"

TIPS_FILES_4_TITLE="Overwrite File Contents"
TIPS_FILES_4_CMD="command > file"
TIPS_FILES_4_DESC="Redirect output to file, overwriting existing contents. Creates file if missing"

TIPS_FILES_5_TITLE="Empty a File Being Written To"
TIPS_FILES_5_CMD="> file"
TIPS_FILES_5_DESC="Truncate a file without deleting it. Safe for files open by processes"

TIPS_FILES_6_TITLE="Follow File as It Grows"
TIPS_FILES_6_CMD="tail -f file"
TIPS_FILES_6_DESC="View real-time updates to a log file. Ctrl+C to stop"

TIPS_FILES_7_TITLE="Delete Empty Directories"
TIPS_FILES_7_CMD="find . -type d -empty -delete"
TIPS_FILES_7_DESC="Recursively remove all empty directories from current path"

TIPS_FILES_8_TITLE="Replace String in Multiple Files"
TIPS_FILES_8_CMD="find /path -type f -exec sed -i.bak 's/string/replacement/g' {} \\;"
TIPS_FILES_8_DESC="In-place edit with backup across all files in a directory tree"

TIPS_FILES_9_TITLE="View Files in Tree Format"
TIPS_FILES_9_CMD="tree -L <depth>"
TIPS_FILES_9_DESC="Display directory structure as a tree. Use -d for directories only"

# ─── Miscellaneous ──────────────────────────────────────────────────────────────

TIPS_MISC_COUNT=8

TIPS_MISC_1_TITLE="Change to Previous Directory"
TIPS_MISC_1_CMD="cd -"
TIPS_MISC_1_DESC="Return to previous working directory. Uses \$OLDPWD environment variable"

TIPS_MISC_2_TITLE="Reset Terminal Display"
TIPS_MISC_2_CMD="reset"
TIPS_MISC_2_DESC="Fix garbled terminal after displaying binary files or bad escape sequences"

TIPS_MISC_3_TITLE="Search Wikipedia via DNS"
TIPS_MISC_3_CMD="dig +short txt <topic>.wp.dg.cx"
TIPS_MISC_3_DESC="Look up Wikipedia article summary using DNS TXT records"

TIPS_MISC_4_TITLE="Display Date in Different Timezone"
TIPS_MISC_4_CMD="TZ=UTC date"
TIPS_MISC_4_DESC="Show current time in any timezone. Examples: TZ=America/Los_Angeles date"

TIPS_MISC_5_TITLE="Display Calendar"
TIPS_MISC_5_CMD="cal [MM YYYY]"
TIPS_MISC_5_DESC="Show calendar. Use cal -3 for previous, current, and next month"

TIPS_MISC_6_TITLE="Extract Tar to Different Directory"
TIPS_MISC_6_CMD="tar xf file.tar -C /path/to/dir"
TIPS_MISC_6_DESC="Extract tarball to specified directory without cd-ing there first"

TIPS_MISC_7_TITLE="Command Line Stopwatch"
TIPS_MISC_7_CMD="time read"
TIPS_MISC_7_DESC="Press Enter to stop timing. Shows elapsed real time"

TIPS_MISC_8_TITLE="Repeat Command and Watch Output"
TIPS_MISC_8_CMD="watch -n <seconds> command"
TIPS_MISC_8_DESC="Execute command periodically and display output. Great for monitoring"

# ─── Quick Reference ────────────────────────────────────────────────────────────

TIPS_TOTAL=62
