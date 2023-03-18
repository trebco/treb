#!/bin/bash

#
# print a list of all --treb css vars used in any treb* directory. 
# uses bash wizardry.
#
# of course you should be noting these when you create them. but
# this is a useful check that we haven't missed anything.
#
# note that we're specifically looking for vars being /used/, not 
# /defined/. which is probably better in case we have vars we're 
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

# remove icons (--treb-icon-, --treb-sidebar-icon)
unique=(${unique[@]//*icon*})

# update: dump as JSON. this is beyond my bashing skills, 
# have to have an empty string

# update2: OK I can do it, but it's ugly

# update3: a little cleaner, but we still set that 
# variable on every pass of the loop

PREFIX="[\n"
for i in ${unique[@]}; do
  printf "${PREFIX}\t\"%s\"" $i
  PREFIX=",\n";
done;
printf "\n]\n"


