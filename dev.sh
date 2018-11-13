#!/bin/bash

yarn remove @ournet/domain
yarn remove @ournet/news-domain
yarn remove dynamo-item

yarn link @ournet/domain
yarn link @ournet/news-domain
yarn link dynamo-item

yarn test
