/* eslint-disable @typescript-eslint/no-explicit-any */
import bcrypt from 'bcrypt';
import { model, Schema } from 'mongoose';
import config from '../../../config';
import { IUser, UserModal } from './user.interface';

const userSchema = new Schema<IUser, UserModal>(
  {
    name: {
      type: String,
      required: false,
      default: '',
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      select: 0,
      minlength: 8,
    },
    googleId: {
      type: String,
    },
    facebookId: {
      type: String,
    },
    appleId: {
      type: String,
    },
    phone: {
      type: String,
      required: false,
      default: '',
    },
    role: {
      type: String,
      default: 'USER',
    },
    image: {
      type: String,
      default: '',
    },
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'OTHERS'],
      default: 'MALE',
    },
    age: {
      type: Number,
      default: null,
    },
    payment: {
      type: Boolean,
      default: false,
    },
    subscription: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    verified: {
      type: Boolean,
      default: false,
    },

    authentication: {
      type: {
        isResetPassword: {
          type: Boolean,
          default: false,
        },
        oneTimeCode: {
          type: Number,
          default: null,
        },
        expireAt: {
          type: Date,
          default: null,
        },
      },
      select: 0,
    },
  },
  { timestamps: true },
);

userSchema.index({ name: 'text', email: 'text', phone: 'text' });
userSchema.index({ phone: 1 });
userSchema.index({ verified: 1, role: 1, createdAt: -1 });
userSchema.index({ createdAt: -1 });

//exist user check
userSchema.statics.isExistUserById = async (id: string) => {
  const isExist = await User.findById(id);
  return isExist;
};

userSchema.statics.isExistUserByEmail = async (email: string) => {
  const isExist = await User.findOne({ email });
  return isExist;
};

//account check
userSchema.statics.isAccountCreated = async (id: string) => {
  const isUserExist: any = await User.findById(id);
  return isUserExist.accountInformation.status;
};

//is match password
userSchema.statics.isMatchPassword = async (
  password: string,
  hashPassword: string,
): Promise<boolean> => {
  return await bcrypt.compare(password, hashPassword);
};

//check user
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  //password hash
  this.password = await bcrypt.hash(
    this.password,
    Number(config.bcrypt_salt_rounds),
  );
  next();
});

export const User = model<IUser, UserModal>('User', userSchema);
