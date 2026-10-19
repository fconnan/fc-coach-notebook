#!/usr/bin/env bash
# shellcheck disable=SC2086 disable=SC2068 disable=SC2012 disable=SC2046
true
set -e
IFS=''
shopt -s nullglob


function install {
    install_node
}

### Usage

function __fc_help {
    args=$(awk '/^function [^_].*/{args=args "|" $2} END {print substr(args, 2)}' $@)
    echo "Usage $1 ($args)"
    exit 1
}

function _help {
    __fc_help ${BASH_SOURCE[0]}
}

${1:-_help} "${@:2}"
