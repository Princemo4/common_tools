#!/bin/bash
# Usage: ./create_deploy_script.sh <tagname> <region> <aws_account>
# Example: ./create_deploy_script.sh examtrust us-east-1 905406865537
# This will create a deploy.sh script that can be used to deploy the examtrust service
# The deploy.sh script will perform the following steps:
#   1. Get the login password for the ECR repository
#   2. Pull the latest image from ECR
#   3. Start the service with the latest image
#   4. Force a recreate of the containers


TAGNAME=$1
AWS_ACCOUNT=$2
REGION=$3
DIRECTORY=$4

if [ -z "$TAGNAME" ] || [ -z "$REGION" ] || [ -z "$AWS_ACCOUNT" ] || [ -z "$DIRECTORY" ]; then
    echo "Usage: ./create_deploy_script.sh <tagname> <aws_account> <region> <directory>"
    exit 1
fi

cat > deploy.sh << EOF
#!/bin/bash
# This script is an output of ./create_deploy_script.sh

# cd to the directory of ALL the applications, not just this one
# usually where docker-compose.yml is located
cd $DIRECTORY

aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com

docker-compose pull $TAGNAME

docker-compose up -d $TAGNAME --force-recreate
EOF
