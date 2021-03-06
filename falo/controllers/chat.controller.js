const { User, UserProfile, ChatRoom } = require('../models')
const ObjectId = require('mongodb').ObjectId;

const joinChatRoom = async (req, res, next) => {
    let user_to, user_sender
    await UserProfile.find({ email: { $in: [req.body.email, req.user.email] } }).populate('idUser').then(data => {
        data.forEach(user_profile => {
            if (user_profile.idUser.email == req.body.email) {
                user_to = user_profile
            }
            if (user_profile.idUser.email == req.user.email) {
                user_sender = user_profile
            }
        })
    })
    if (typeof (user_to) != 'undefined' && user_to != user_sender) return checkValidRoom(res, user_to, user_sender)
    return res.status(200).json({ id: '', name: 'Not found' })
}

async function checkValidRoom(res, user_to, user_sender) {
    let chat_room_found
    const chat_room_valid = (typeof (user_to.chatRoomList) != 'undefined' && typeof (user_sender.chatRoomList) != 'undefined')
    if (chat_room_valid && user_to.chatRoomList.length > 0 && user_sender.chatRoomList.length > 0) {
        await user_sender.chatRoomList.forEach(chat_room_sender => {
            user_to.chatRoomList.forEach(chat_room_to => {
                if (chat_room_sender.toString() == chat_room_to.toString()) {
                    return chat_room_found = chat_room_sender.toString()
                }
            })
        })
    }
    if (chat_room_found) {
        ChatRoom.findById(chat_room_found).then(chat_room => {
            const chat_room_access = chat_room.accessList.find(user_id => user_id.toString() == user_sender.id)
            chat_room_access ? res.status(200).json({ id: chat_room.id, name: chat_room.name }) : res.status(200).json({ id: '', name: 'Forbidden' })
        })
    } else {
        return createChatRoom(res, user_to, user_sender)
    }
}


function createChatRoom(res, user_to, user_sender) {
    let chatRoom = new ChatRoom()
    chatRoom.accessList = [user_to.id, user_sender.id]
    chatRoom.name = user_to.idUser.email.substring(0, user_to.idUser.email.lastIndexOf("@")) + ' - ' + user_sender.idUser.email.substring(0, user_sender.idUser.email.lastIndexOf("@"))
    chatRoom.save(err => {
        UserProfile.findByIdAndUpdate(user_sender.id, { $addToSet: { chatRoomList: chatRoom.id } })
            .exec(_err => {
                UserProfile
                    .findByIdAndUpdate(user_to.id, { $addToSet: { chatRoomList: chatRoom.id } })
                    .exec(_ => {
                        console.log(`Create new chat room id: ${chatRoom.id}`)
                        return res.status(200).json({ id: chatRoom.id, name: chatRoom.name })
                    })
            })
    })
}


const getChatRoom = async (req, res, next) => {
    await UserProfile.findOne({ idUser: ObjectId(req.user.id) }).populate('idUser').populate('chatRoomList').select('chatRoomList').then(data => {
        res.status(200).json(data.chatRoomList)
    })
}


const joinChatRoomById = (req, res, next) => {
    ChatRoom
        .findById(req.body.chat_room_id)
        .populate('accessList')
        .then(data => {
            if (data.accessList.find(user_profile => user_profile._id.toString() == req.body.user_profile_id)){
                res.status(200).json({ id: data.id.toString(), name: data.name, messageList: data.messageList })
            } else {
                res.status(200).json({ id: '', name: 'Access denied' })
            }
        })
        .catch(err => {
            console.log(err);
        })
}

const sendMessage = (req, res, next) => {
    ChatRoom
        .findById(req.body.chat_room_id)
        .populate('accessList')
        .select('accessList')
        .then(data => {
            if (data.accessList.find(user_profile => user_profile._id.toString() == req.body.from)) {
                ChatRoom.findByIdAndUpdate(req.body.chat_room_id, { $push: { messageList: { message: req.body.message, from: req.body.from, sender: req.body.sender } } })
                    .exec(_ => res.status(200).json({ id: data.id.toString(), message: 'Done' }))
            } else {
                res.status(200).json({ id: '', name: 'Access denied' })
            }
        })
        .catch(err => {
            console.log(err)
        })
}

const renameChatRoom = (req, res, next) => {
    ChatRoom
        .findById(req.body.chat_room_id)
        .populate('accessList')
        .select('accessList')
        .then(data => {
            if (data.accessList.find(user_profile => user_profile._id.toString() == req.body.user_profile_id)) {
                ChatRoom
                    .findByIdAndUpdate(req.body.chat_room_id, { name: req.body.chat_room_new_name })
                    .exec(_ => res.status(200).json({ id: data.id.toString(), name: req.body.chat_room_new_name }))
            } else {
                res.status(200).json({ id: '', name: 'Access denied' })
            }
        })
        .catch(err => {
            console.log(err)
        })
}

module.exports = {
    joinChatRoom,
    joinChatRoomById,
    getChatRoom,
    renameChatRoom,
    sendMessage
}