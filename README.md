
switching from modules to a single, monolithic repo. the issue was
compiling each module separately; that worked, but it won't support
switching between es5/es6 if we want to do 'modern' builds.

OTOH, this structure makes it more difficult to reuse modules... we
should construct some mechanism for exporting modules for separate
build & use.
 