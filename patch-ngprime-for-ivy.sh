#!/bin/bash

#Replace an invalid import
sed -i 's/\@angular\/core\/src\/metadata\/lifecycle_hooks/\@angular\/core/' node_modules/primeng/components/table/table.d.ts
