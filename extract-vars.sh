#!/bin/bash

#
# print a list of all --treb css vars used in any treb* directory. 
# bash wizardry.
#
# of course you should be noting these when you create them. but
# this is a useful check that we haven't missed anything.
#
# note that we're specifically looking for vars being /used/, not 
# defined. which is probably better in case we have vars we're 
# defining but never using.
#

regexp="(--treb[[:alnum:]_\-]+)"

# search and filter
unique=($(
  for i in `grep -ir "var(\\s*--treb" treb*`; do
    if [[ $i =~ $regexp ]]; then
      echo "${BASH_REMATCH[1]}";
    fi
  done | sort -u))

# dump uniques
for i in ${unique[@]}; do
  echo $i
done;



