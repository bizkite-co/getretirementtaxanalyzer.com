#!/bin/bash

# A function to find and replace text in files, with an option to preview changes.
#
# Usage: source find_replace.sh && find_replace <find_pattern> <replace_string> [-e|--execute] <file1> [<file2> ...]
#
# Arguments:
#   find_pattern: The regex pattern to find.
#   replace_string: The string to replace the pattern with.
#   -e, --execute: A flag to apply the changes. If not provided, a diff of the changes will be shown.
#   files: One or more files to perform the find and replace on.

find_replace() {
  local find_pattern="$1"
  shift
  local replace_string="$1"
  shift
  local execute_flag=false
  local files=()

  while (( "$#" )); do
    case "$1" in
      -e|--execute)
        execute_flag=true
        shift
        ;;
      *)
        files+=("$1")
        shift
        ;;
    esac
  done

  if [ ${#files[@]} -eq 0 ]; then
    echo "Usage: source find_replace.sh && find_replace <find_pattern> <replace_string> [-e|--execute] <file1> [<file2> ...]"
    return 1
  fi

  for file in "${files[@]}"; do
    if [ ! -f "$file" ]; then
      echo "Error: File not found: $file"
      continue
    fi

    if "$execute_flag"; then
      perl -i -pe "s#$find_pattern#$replace_string#g" "$file"
      echo "Applied changes to $file"
    else
      echo "Changes for $file:"
      perl -pe "s#$find_pattern#$replace_string#g" "$file" | diff --unified=0 "$file" -
    fi
  done
}
